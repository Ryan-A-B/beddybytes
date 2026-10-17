package internal

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
	"github.com/dgrijalva/jwt-go"
)

func TestAuthorizationRejectsRefreshTokens(t *testing.T) {
	key := []byte("test-key")
	for _, tc := range []struct {
		name, use, scope string
		want             int
	}{
		{"access", "access", "account monitor", 204},
		{"legacy access", "", "", 204},
		{"refresh", "refresh", "account monitor", 401},
		{"legacy refresh", "", "account refresh_token", 401},
		{"unknown type", "other", "account", 401},
		{"explicit access overrides legacy scope", "access", "refresh_token", 204},
	} {
		t.Run(tc.name, func(t *testing.T) {
			claims := Claims{Issuer: "beddybytes", Audience: "beddybytes", Expiry: time.Now().Add(time.Hour).Unix(), Subject: URN{Service: "iam", AccountID: "account", ResourceType: "user", ResourceID: "user"}, TokenUse: tc.use, Scope: tc.scope}
			token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &claims).SignedString(key)
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequest("GET", "/", nil)
			request.Header.Set("Authorization", "Bearer "+token)
			response := httptest.NewRecorder()
			NewAuthorizationMiddleware(key).Middleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) })).ServeHTTP(response, request)
			if response.Code != tc.want {
				t.Fatalf("status %d, want %d", response.Code, tc.want)
			}
		})
	}
}

func TestAuthorizationRequiresMonitorScope(t *testing.T) {
	key := []byte("test-key")
	for _, test := range []struct {
		name, scope, tokenUse string
		expired               bool
		want                  int
	}{
		{name: "account only", scope: "account", want: 403},
		{name: "missing scope", want: 403},
		{name: "scope prefix", scope: "account monitoring", want: 403},
		{name: "scope suffix", scope: "account not_monitor", want: 403},
		{name: "monitor", scope: "account monitor", want: 204},
		{name: "scope order", scope: "monitor account", want: 204},
		{name: "monitor only", scope: "monitor", want: 204},
		{name: "refresh", scope: "account monitor", tokenUse: TokenUseRefresh, want: 401},
		{name: "expired", scope: "account monitor", expired: true, want: 401},
	} {
		t.Run(test.name, func(t *testing.T) {
			expiry := time.Now().Add(time.Hour).Unix()
			if test.expired {
				expiry = time.Now().Add(-time.Hour).Unix()
			}
			tokenUse := test.tokenUse
			if tokenUse == "" {
				tokenUse = TokenUseAccess
			}
			claims := Claims{Issuer: "beddybytes", Audience: "beddybytes", Subject: URN{Service: "iam", AccountID: "account", ResourceType: "user", ResourceID: "user"}, TokenUse: tokenUse, Scope: test.scope, Expiry: expiry}
			token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &claims).SignedString(key)
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequest(http.MethodGet, "/", nil)
			request.Header.Set("Authorization", "Bearer "+token)
			response := httptest.NewRecorder()
			called := false
			NewAuthorizationMiddleware(key, "monitor").Middleware(http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
				called = true
				if contextx.GetAccountID(request.Context()) != "account" {
					t.Fatal("account context missing")
				}
				responseWriter.WriteHeader(http.StatusNoContent)
			})).ServeHTTP(response, request)
			if response.Code != test.want || called != (test.want == 204) {
				t.Fatalf("status=%d called=%v, want %d", response.Code, called, test.want)
			}
			if test.want == 403 {
				var output httpx.ErrorFrame
				if err := json.Unmarshal(response.Body.Bytes(), &output); err != nil {
					t.Fatal(err)
				}
				if output.Code != "insufficient_scope" {
					t.Fatalf("code=%q", output.Code)
				}
			}
		})
	}
}
