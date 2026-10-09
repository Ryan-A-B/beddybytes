package accounts

import (
	"errors"
	"net/http"
	"net/url"
	"strings"
)

func FrontendAuthorizationRedirectURLFromEnvironment(getenv func(string) string) (url.URL, error) {
	u, err := url.Parse(getenv("FRONTEND_AUTH_REDIRECT"))
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || u.Path == "" || u.Path == "/" || strings.Contains(u.Host, " ") {
		return url.URL{}, errors.New("FRONTEND_AUTH_REDIRECT must be an HTTPS callback URL without query parameters or fragment")
	}
	return *u, nil
}

type AuthorizationErrorCode string

const (
	AuthorizationErrorAccountNotFound        AuthorizationErrorCode = "account_not_found"
	AuthorizationErrorAccountAlreadyExists   AuthorizationErrorCode = "account_already_exists"
	AuthorizationErrorInvalidRequest         AuthorizationErrorCode = "invalid_request"
	AuthorizationErrorInvalidGrant           AuthorizationErrorCode = "invalid_grant"
	AuthorizationErrorUnauthorized           AuthorizationErrorCode = "unauthorized"
	AuthorizationErrorUnsupported            AuthorizationErrorCode = "unsupported"
	AuthorizationErrorAccessDenied           AuthorizationErrorCode = "access_denied"
	AuthorizationErrorProviderUnavailable    AuthorizationErrorCode = "provider_unavailable"
	AuthorizationErrorServerError            AuthorizationErrorCode = "server_error"
	AuthorizationErrorTemporarilyUnavailable AuthorizationErrorCode = "temporarily_unavailable"
)

func (handlers *Handlers) redirectAuthorizationSuccess(responseWriter http.ResponseWriter, request *http.Request, state, code string) {
	redirectURL := handlers.FrontendAuthorizationRedirectURL
	query := redirectURL.Query()
	query.Set("state", state)
	query.Set("code", code)
	redirectURL.RawQuery = query.Encode()
	responseWriter.Header().Set("Cache-Control", "no-store")
	responseWriter.Header().Set("Referrer-Policy", "no-referrer")
	http.Redirect(responseWriter, request, redirectURL.String(), http.StatusSeeOther)
}

func (handlers *Handlers) redirectAuthorizationFailure(responseWriter http.ResponseWriter, request *http.Request, code AuthorizationErrorCode, verifiedState string) {
	redirectURL := handlers.FrontendAuthorizationRedirectURL
	query := redirectURL.Query()
	query.Set("error", string(code))
	if verifiedState != "" {
		query.Set("state", verifiedState)
	}
	redirectURL.RawQuery = query.Encode()
	responseWriter.Header().Set("Cache-Control", "no-store")
	responseWriter.Header().Set("Referrer-Policy", "no-referrer")
	http.Redirect(responseWriter, request, redirectURL.String(), http.StatusFound)
}
