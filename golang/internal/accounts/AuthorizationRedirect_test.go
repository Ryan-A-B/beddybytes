package accounts

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestFrontendAuthorizationRedirectConfiguration(t *testing.T) {
	for _, redirect := range []string{"https://app.example.com/auth/callback", "https://app.example.com:8443/auth/callback"} {
		u, err := FrontendAuthorizationRedirectURLFromEnvironment(func(key string) string {
			if key == "FRONTEND_AUTH_REDIRECT" {
				return redirect
			}
			return ""
		})
		if err != nil || u.String() != redirect {
			t.Fatal("shared frontend redirect URL was not preserved independently of Google configuration")
		}
	}
	for _, redirect := range []string{"", "https://app.example.com", "https://app.example.com/", "http://app.example.com/auth/callback", "https://user:password@app.example.com/auth/callback", "https://app.example.com/auth/callback?next=evil", "https://app.example.com/auth/callback?", "https://app.example.com/auth/callback#fragment"} {
		if _, err := FrontendAuthorizationRedirectURLFromEnvironment(func(string) string { return redirect }); err == nil {
			t.Fatalf("invalid frontend redirect accepted: %q", redirect)
		}
	}
}

func TestSharedAuthorizationRedirectsDoNotMutateConfiguredURL(t *testing.T) {
	base, err := url.Parse("https://app.example.com/auth/callback")
	if err != nil {
		t.Fatal(err)
	}
	handlers := &Handlers{FrontendAuthorizationRedirectURL: *base}
	request := httptest.NewRequest(http.MethodGet, "/auth/callback", nil)
	success := httptest.NewRecorder()
	handlers.redirectAuthorizationSuccess(success, request, "frontend-state", "code")
	if success.Code != http.StatusSeeOther {
		t.Fatal("success was not redirected")
	}
	location, _ := url.Parse(success.Header().Get("Location"))
	if location.Query().Get("state") != "frontend-state" || location.Query().Get("code") != "code" {
		t.Fatal("success lost its code or state")
	}
	for _, state := range []string{"", "verified-state"} {
		failure := httptest.NewRecorder()
		handlers.redirectAuthorizationFailure(failure, request, AuthorizationErrorAccessDenied, state)
		location, _ := url.Parse(failure.Header().Get("Location"))
		if failure.Code != http.StatusFound || location.Query().Get("error") != "access_denied" || location.Query().Get("state") != state || location.Query().Get("code") != "" {
			t.Fatal("failure lost its error/state or leaked the previous authorization code")
		}
		if failure.Header().Get("Cache-Control") != "no-store" || failure.Header().Get("Referrer-Policy") != "no-referrer" {
			t.Fatal("failure redirect was not protected from caching/referrer leakage")
		}
	}
	if handlers.FrontendAuthorizationRedirectURL.String() != base.String() {
		t.Fatal("redirect modified the shared configured URL")
	}
}
