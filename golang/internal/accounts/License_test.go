package accounts

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/accountrepository"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
	"github.com/dgrijalva/jwt-go"
)

func TestGetAccountReturnsCurrentLicense(t *testing.T) {
	handlers, router, _, log := googleTestHandlers(t)
	userID := models.UserID{Issuer: GoogleIssuer, Subject: "license-user"}
	accountID := createTestAccount(t, handlers, accountrepository.CreateAccountInput{UserID: userID})
	license, err := handlers.AccountQueryHandler.GetLicenseForAccount(context.Background(), accountID)
	if err != nil {
		t.Fatal(err)
	}
	trialStart := license.StartUnixSeconds
	for _, step := range []struct {
		eventType eventlog.EventType
		want      models.LicenseType
	}{
		{want: models.LicenseTypeTrial},
		{eventType: events.TypeProvisionalLicenseGranted, want: models.LicenseTypeProvisional},
		{eventType: events.TypeProvisionalLicenseRevoked, want: models.LicenseTypeTrial},
		{eventType: events.TypePerpetualLicenseGranted, want: models.LicenseTypePerpetual},
	} {
		t.Run(string(step.want)+string(step.eventType), func(t *testing.T) {
			want := models.NewTrialLicense(trialStart)
			if step.eventType != "" {
				event, err := log.Append(context.Background(), eventlog.AppendInput{Type: step.eventType, AccountID: accountID})
				if err != nil {
					t.Fatal(err)
				}
				want.Type = step.want
				if step.want != models.LicenseTypeTrial {
					want.StartUnixSeconds = event.UnixTimestamp
					want.TrialDetail = nil
				}
				if step.want == models.LicenseTypeProvisional {
					want.ProvisionalDetail = &models.ProvisionalLicenseDetail{TrialStartUnixSeconds: trialStart}
				}
			}
			// An account-only token can display the license, including after expiry.
			token, err := jwt.NewWithClaims(handlers.SigningMethod, &internal.Claims{
				Issuer: "beddybytes", Audience: "beddybytes", Subject: createSubject(accountID, userID),
				Scope: "account", TokenUse: internal.TokenUseAccess, Expiry: time.Now().Add(time.Hour).Unix(),
			}).SignedString(handlers.Key)
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequest(http.MethodGet, "/accounts/current", nil)
			request.Header.Set("Authorization", "Bearer "+token)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
			}
			if response.Header().Get("Content-Type") != "application/json" {
				t.Errorf("Content-Type=%q", response.Header().Get("Content-Type"))
			}
			var output GetAccountOutput
			if err := json.Unmarshal(response.Body.Bytes(), &output); err != nil {
				t.Fatal(err)
			}
			if output.ID != accountID || !reflect.DeepEqual(output.License, want) {
				t.Fatalf("output=%+v, want id=%s license=%+v", output, accountID, want)
			}
			var licenseJSON map[string]json.RawMessage
			if err := json.Unmarshal(response.Body.Bytes(), &struct {
				License *map[string]json.RawMessage `json:"license"`
			}{License: &licenseJSON}); err != nil {
				t.Fatal(err)
			}
			if _, hasEnd := licenseJSON["trial_detail"]; hasEnd != (step.want == models.LicenseTypeTrial) {
				t.Error("trial detail must only be serialized for trials")
			}
			var raw map[string]json.RawMessage
			if err := json.Unmarshal(response.Body.Bytes(), &raw); err != nil {
				t.Fatal(err)
			}
			if len(raw) != 2 || raw["id"] == nil || raw["license"] == nil {
				t.Fatalf("unexpected response fields: %s", response.Body.String())
			}
		})
	}
}

func TestGetAccountStillRequiresMatchingAccountAuthorization(t *testing.T) {
	handlers, router, _, _ := googleTestHandlers(t)
	for _, test := range []struct {
		name, path, authorization string
		want                      int
	}{
		{name: "unauthenticated", path: "/accounts/current", want: http.StatusUnauthorized},
		{name: "different account", path: "/accounts/other-account", authorization: "Bearer " + testAccessToken(t, handlers, createSubject("account-1", models.UserID{Issuer: GoogleIssuer, Subject: "user-1"})), want: http.StatusForbidden},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, test.path, nil)
			request.Header.Set("Authorization", test.authorization)
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != test.want {
				t.Fatalf("status=%d want=%d", response.Code, test.want)
			}
		})
	}
}
