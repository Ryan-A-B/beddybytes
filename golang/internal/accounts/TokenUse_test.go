package accounts

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/dgrijalva/jwt-go"
)

func TestPasswordGrantScopesSurviveRefresh(t *testing.T) {
	handlers, router, _, _ := googleTestHandlers(t)
	account := &Account{ID: "password-account", User: NewInternalIdentityUser(&NewInternalIdentityUserInput{Email: "user@example.com", Password: "long-enough-password"})}
	if err := handlers.AccountStore.Put(context.Background(), account); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest("POST", "/token", strings.NewReader("grant_type=password&username=user%40example.com&password=long-enough-password"))
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	for rotation := 0; rotation < 3; rotation++ {
		if response.Code != http.StatusOK {
			t.Fatalf("token response: %d %s", response.Code, response.Body.String())
		}
		var output AccessTokenOutput
		if err := json.Unmarshal(response.Body.Bytes(), &output); err != nil {
			t.Fatal(err)
		}
		var access internal.Claims
		if _, err := jwt.ParseWithClaims(output.AccessToken, &access, handlers.getKey); err != nil {
			t.Fatal(err)
		}
		if access.TokenUse != internal.TokenUseAccess || access.Scope != "account monitor" {
			t.Fatalf("wrong access claims: %+v", access)
		}
		cookies := response.Result().Cookies()
		if len(cookies) != 1 {
			t.Fatal("expected refresh cookie")
		}
		var refresh jwt.MapClaims
		if _, err := jwt.ParseWithClaims(cookies[0].Value, &refresh, handlers.getKey); err != nil {
			t.Fatal(err)
		}
		if refresh["token_use"] != "refresh" || refresh["scp"] != "account monitor" || refresh["access_scope"] != nil {
			t.Fatalf("wrong refresh claims: %+v", refresh)
		}
		request = httptest.NewRequest("POST", "/token", strings.NewReader("grant_type=refresh_token&scope=admin"))
		request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		request.AddCookie(cookies[0])
		response = httptest.NewRecorder()
		router.ServeHTTP(response, request)
	}
}

func TestRefreshTokenTypeAndLegacyMigration(t *testing.T) {
	for _, tc := range []struct {
		name, use, scope, wantScope string
		status                      int
	}{
		{name: "new refresh", use: "refresh", scope: "monitor", wantScope: "account monitor", status: 200},
		{name: "legacy password refresh", scope: "refresh_token", wantScope: "account monitor", status: 200},
		{name: "access cannot refresh", use: "access", scope: "refresh_token", status: 401},
		{name: "legacy access cannot refresh", scope: "account monitor", status: 401},
		{name: "unknown type cannot refresh", use: "other", scope: "refresh_token", status: 401},
	} {
		t.Run(tc.name, func(t *testing.T) {
			handlers, router, _, _ := googleTestHandlers(t)
			account := &Account{ID: "account", User: NewInternalIdentityUser(&NewInternalIdentityUserInput{Email: "user@example.com", Password: "long-enough-password"})}
			if err := handlers.AccountStore.Put(context.Background(), account); err != nil {
				t.Fatal(err)
			}
			claims := jwt.MapClaims{"iss": "beddybytes", "aud": "beddybytes", "exp": time.Now().Add(time.Hour).Unix(), "jti": "unique-refresh", "sub": (&internal.URN{Service: "iam", AccountID: account.ID, ResourceType: "user", ResourceID: account.User.ID}).String(), "scp": tc.scope}
			if tc.use != "" {
				claims["token_use"] = tc.use
			}
			token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(handlers.Key)
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequest("POST", "/token", strings.NewReader("grant_type=refresh_token"))
			request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			request.AddCookie(&http.Cookie{Name: "refresh_token", Value: token})
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != tc.status {
				t.Fatalf("status %d, want %d: %s", response.Code, tc.status, response.Body.String())
			}
			if tc.status != 200 {
				return
			}
			replay := httptest.NewRecorder()
			replayRequest := httptest.NewRequest("POST", "/token", strings.NewReader("grant_type=refresh_token"))
			replayRequest.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			replayRequest.AddCookie(&http.Cookie{Name: "refresh_token", Value: token})
			router.ServeHTTP(replay, replayRequest)
			if replay.Code != http.StatusUnauthorized {
				t.Fatal("refresh token replay accepted")
			}
			var output AccessTokenOutput
			if err := json.Unmarshal(response.Body.Bytes(), &output); err != nil {
				t.Fatal(err)
			}
			var access internal.Claims
			if _, err := jwt.ParseWithClaims(output.AccessToken, &access, handlers.getKey); err != nil {
				t.Fatal(err)
			}
			if access.Scope != tc.wantScope || access.TokenUse != "access" {
				t.Fatalf("wrong migrated access claims: %+v", access)
			}
			var refresh internal.Claims
			if _, err := jwt.ParseWithClaims(response.Result().Cookies()[0].Value, &refresh, handlers.getKey); err != nil {
				t.Fatal(err)
			}
			if refresh.TokenUse != "refresh" || refresh.Scope != tc.wantScope {
				t.Fatalf("wrong migrated refresh claims: %+v", refresh)
			}
		})
	}
}
