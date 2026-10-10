package accounts

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/dgrijalva/jwt-go"
)

func TestGoogleOIDCProtocolAndSignedTokenValidation(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	for _, scenario := range []string{"valid", "issuer_alias", "wrong_issuer", "wrong_audience", "expired", "wrong_nonce", "empty_subject", "unverified_email", "missing_email", "wrong_signature"} {
		t.Run(scenario, func(t *testing.T) {
			claims := jwt.MapClaims{"iss": GoogleIssuer, "aud": "google-client", "sub": "opaque:Google/Subject+01", "exp": time.Now().Add(time.Hour).Unix(), "iat": time.Now().Unix(), "nonce": "nonce", "email": "user@example.com", "email_verified": true}
			signingKey := key
			switch scenario {
			case "issuer_alias":
				claims["iss"] = "accounts.google.com"
			case "wrong_issuer":
				claims["iss"] = "https://attacker.example"
			case "wrong_audience":
				claims["aud"] = "attacker-client"
			case "expired":
				claims["exp"] = time.Now().Add(-time.Hour).Unix()
			case "wrong_nonce":
				claims["nonce"] = "other-nonce"
			case "empty_subject":
				claims["sub"] = ""
			case "unverified_email":
				claims["email_verified"] = false
			case "missing_email":
				delete(claims, "email")
			case "wrong_signature":
				signingKey, err = rsa.GenerateKey(rand.Reader, 2048)
				if err != nil {
					t.Fatal(err)
				}
			}
			token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
			token.Header["kid"] = "test-key"
			raw, err := token.SignedString(signingKey)
			if err != nil {
				t.Fatal(err)
			}
			upstreamVerifier, _ := randomSecret()
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				if r.URL.Path == "/keys" {
					json.NewEncoder(w).Encode(map[string]interface{}{"keys": []interface{}{map[string]string{"kty": "RSA", "kid": "test-key", "alg": "RS256", "use": "sig", "n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()), "e": "AQAB"}}})
					return
				}
				r.ParseForm()
				if r.Form.Get("code") != "google-code" || r.Form.Get("grant_type") != "authorization_code" || r.Form.Get("code_verifier") != upstreamVerifier || r.Form.Get("client_secret") != "google-secret" || r.Form.Get("redirect_uri") != "https://api.example.com/auth/google/callback" {
					t.Error("incorrect upstream code exchange")
				}
				json.NewEncoder(w).Encode(map[string]interface{}{"access_token": "unused-google-access-token", "token_type": "Bearer", "expires_in": 3600, "id_token": raw})
			}))
			defer server.Close()
			provider := NewGoogleIdentityProvider("google-client", "google-secret", "https://api.example.com/auth/google/callback").(*googleOIDCProvider)
			provider.config.Endpoint.TokenURL = server.URL + "/token"
			provider.verifier = oidc.NewVerifier(GoogleIssuer, oidc.NewRemoteKeySet(context.Background(), server.URL+"/keys"), &oidc.Config{ClientID: "google-client", SupportedSigningAlgs: []string{oidc.RS256}})
			u, _ := url.Parse(provider.AuthorizationURL("upstream-state", "nonce", upstreamVerifier))
			q := u.Query()
			if q.Get("scope") != "openid email" || q.Get("nonce") != "nonce" || q.Get("state") != "upstream-state" || q.Get("response_type") != "code" || q.Get("code_challenge_method") != "S256" || q.Get("code_challenge") != challengeFor(upstreamVerifier) {
				t.Fatal("wrong Google authentication request")
			}
			identity, err := provider.Exchange(context.Background(), "google-code", "nonce", upstreamVerifier)
			if scenario == "valid" || scenario == "issuer_alias" {
				if err != nil || identity.Issuer != GoogleIssuer || identity.Subject != "opaque:Google/Subject+01" || identity.Email != "user@example.com" {
					t.Fatalf("valid identity rejected: %v", err)
				}
			} else if err == nil {
				t.Fatal("invalid Google ID token accepted")
			}
		})
	}
}
