package internal

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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
