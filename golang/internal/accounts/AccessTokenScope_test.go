package accounts

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/accountrepository"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
	"github.com/dgrijalva/jwt-go"
)

func testAccessToken(t *testing.T, handlers *Handlers, subject internal.URN) string {
	t.Helper()
	token, err := jwt.NewWithClaims(handlers.SigningMethod, &internal.Claims{Issuer: "beddybytes", Audience: "beddybytes", Subject: subject, Scope: "account monitor", TokenUse: internal.TokenUseAccess, Expiry: time.Now().Add(time.Hour).Unix()}).SignedString(handlers.Key)
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func tokenScopeResponse(t *testing.T, handlers *Handlers, response *httptest.ResponseRecorder, want string) *http.Cookie {
	t.Helper()
	if response.Code != http.StatusOK {
		t.Fatalf("token response: %d %s", response.Code, response.Body.String())
	}
	var output AccessTokenOutput
	if err := json.Unmarshal(response.Body.Bytes(), &output); err != nil {
		t.Fatal(err)
	}
	var claims internal.Claims
	if _, err := jwt.ParseWithClaims(output.AccessToken, &claims, handlers.getKey); err != nil {
		t.Fatal(err)
	}
	if claims.Scope != want || claims.TokenUse != internal.TokenUseAccess {
		t.Fatalf("access scope=%q use=%q, want %q access", claims.Scope, claims.TokenUse, want)
	}
	for _, cookie := range response.Result().Cookies() {
		if cookie.Name == "refresh_token" {
			return cookie
		}
	}
	t.Fatal("refresh cookie missing")
	return nil
}

func tokenFormRequest(router http.Handler, form url.Values, cookie *http.Cookie) *httptest.ResponseRecorder {
	request := httptest.NewRequest(http.MethodPost, "/token", strings.NewReader(form.Encode()))
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if cookie != nil {
		request.AddCookie(cookie)
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func TestTokenGrantsUseCurrentLicense(t *testing.T) {
	for _, grant := range []string{"password", "refresh_token", "authorization_code"} {
		for _, state := range []string{"active trial", "expired trial", "provisional", "revoked provisional", "perpetual"} {
			t.Run(grant+"/"+state, func(t *testing.T) {
				handlers, router, provider, log := googleTestHandlers(t)
				userID := models.UserID{Issuer: accountrepository.IssuerBeddybytes, Subject: "scope@example.com"}
				if grant == "authorization_code" {
					userID = models.UserID{Issuer: GoogleIssuer, Subject: provider.identity.Subject}
				}
				account, err := handlers.AccountCommandHandler.CreateAccount(context.Background(), accountrepository.CreateAccountInput{UserID: userID, Email: "scope@example.com", Password: "long-enough-password-for-tests"})
				if err != nil {
					t.Fatal(err)
				}
				// Change persisted creation time before the query projection reads it.
				if state != "active trial" {
					log.events[0].UnixTimestamp = time.Now().Add(-8 * 24 * time.Hour).Unix()
				}
				appendLicense := func(eventType eventlog.EventType) {
					t.Helper()
					if _, err := log.Append(context.Background(), eventlog.AppendInput{Type: eventType, AccountID: account.ID}); err != nil {
						t.Fatal(err)
					}
				}
				switch state {
				case "provisional":
					appendLicense(events.TypeProvisionalLicenseGranted)
				case "revoked provisional":
					appendLicense(events.TypeProvisionalLicenseGranted)
					appendLicense(events.TypeProvisionalLicenseRevoked)
				case "perpetual":
					appendLicense(events.TypePerpetualLicenseGranted)
				}
				want := "account monitor"
				if state == "expired trial" || state == "revoked provisional" {
					want = "account"
				}
				var response *httptest.ResponseRecorder
				switch grant {
				case "password":
					response = tokenFormRequest(router, url.Values{"grant_type": {"password"}, "username": {"scope@example.com"}, "password": {"long-enough-password-for-tests"}, "scope": {"account monitor admin"}}, nil)
				case "refresh_token":
					// Neither cookie scope nor requested scope overrides current entitlement.
					claims := internal.Claims{Issuer: "beddybytes", Audience: "beddybytes", ID: "scope-refresh", Subject: createSubject(account.ID, userID), Scope: "account", TokenUse: internal.TokenUseRefresh, Expiry: time.Now().Add(time.Hour).Unix()}
					if want == "account" {
						claims.Scope = "account monitor"
					}
					token, err := jwt.NewWithClaims(handlers.SigningMethod, &claims).SignedString(handlers.Key)
					if err != nil {
						t.Fatal(err)
					}
					response = tokenFormRequest(router, url.Values{"grant_type": {"refresh_token"}, "scope": {"account monitor admin"}}, &http.Cookie{Name: "refresh_token", Value: token})
				case "authorization_code":
					flow := beginGoogle(t, router, "login")
					code := callbackValues(t, callbackGoogle(router, flow, "")).Get("code")
					response = exchangeBeddybytes(router, code, flow.verifier)
				}
				tokenScopeResponse(t, handlers, response, want)
			})
		}
	}
}

func TestRefreshPicksUpLicenseGrantsAndRevocation(t *testing.T) {
	handlers, router, _, log := googleTestHandlers(t)
	userID := models.UserID{Issuer: accountrepository.IssuerBeddybytes, Subject: "scope@example.com"}
	account, err := handlers.AccountCommandHandler.CreateAccount(context.Background(), accountrepository.CreateAccountInput{UserID: userID, Email: userID.Subject, Password: "long-enough-password-for-tests"})
	if err != nil {
		t.Fatal(err)
	}
	log.events[0].UnixTimestamp = time.Now().Add(-8 * 24 * time.Hour).Unix()
	cookie := handlers.createRefreshTokenCookie(createSubject(account.ID, userID))
	for _, step := range []struct {
		eventType eventlog.EventType
		want      string
	}{
		{"", "account"},
		{events.TypeProvisionalLicenseGranted, "account monitor"},
		{events.TypeProvisionalLicenseRevoked, "account"},
		{events.TypePerpetualLicenseGranted, "account monitor"},
	} {
		if step.eventType != "" {
			if _, err := log.Append(context.Background(), eventlog.AppendInput{Type: step.eventType, AccountID: account.ID}); err != nil {
				t.Fatal(err)
			}
		}
		response := tokenFormRequest(router, url.Values{"grant_type": {"refresh_token"}}, cookie)
		cookie = tokenScopeResponse(t, handlers, response, step.want)
	}
}

func TestAccessTokenRejectsUnknownAccount(t *testing.T) {
	handlers, router, _, _ := googleTestHandlers(t)
	subject := createSubject("missing", models.UserID{Issuer: accountrepository.IssuerBeddybytes, Subject: "missing@example.com"})
	if token, err := handlers.createAccessToken(context.Background(), subject); token != "" || !errors.Is(err, accountrepository.ErrAccountNotFound) {
		t.Fatalf("token issued=%v, error=%v", token != "", err)
	}
	response := tokenFormRequest(router, url.Values{"grant_type": {"refresh_token"}}, handlers.createRefreshTokenCookie(subject))
	if response.Code != http.StatusUnauthorized || len(response.Result().Cookies()) != 0 {
		t.Fatalf("unknown account refresh: status=%d cookies=%d", response.Code, len(response.Result().Cookies()))
	}
}

func TestLegacyAccountRetainsMonitoringScope(t *testing.T) {
	handlers, router, _, log := googleTestHandlers(t)
	hashedPassword := models.NewHashedPassword("long-enough-password-for-tests")
	detail := events.AccountCreatedV1Detail{AccountID: "legacy-account", User: events.UserV1{Email: "legacy@example.com", PasswordSalt: hashedPassword.Salt, PasswordHash: hashedPassword.Digest}}
	data, err := json.Marshal(detail)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := log.Append(context.Background(), eventlog.AppendInput{Type: events.TypeAccountCreatedV1, Data: data}); err != nil {
		t.Fatal(err)
	}
	log.events[0].UnixTimestamp = 1700000000
	response := tokenFormRequest(router, url.Values{"grant_type": {"password"}, "username": {"legacy@example.com"}, "password": {"long-enough-password-for-tests"}}, nil)
	cookie := tokenScopeResponse(t, handlers, response, "account monitor")
	response = tokenFormRequest(router, url.Values{"grant_type": {"refresh_token"}}, cookie)
	tokenScopeResponse(t, handlers, response, "account monitor")
}
