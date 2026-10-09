package accounts

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/ansel1/merry"
	uuid "github.com/satori/go.uuid"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

const browserClientID = "beddybytes-browser"
const googleCallbackPath = "/auth/google/callback"
const googleTransactionTTL = 10 * time.Minute
const authorizationCodeTTL = time.Minute
const maxPendingGoogleEntries = 4096

var pkceChallengePattern = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)
var pkceVerifierPattern = regexp.MustCompile(`^[A-Za-z0-9._~-]{43,128}$`)

type googleTransaction struct {
	Intent, Scope, FrontendState, Challenge, Nonce, UpstreamVerifier, Binding string
	Expires                                                                   time.Time
}

type authorizationRequest struct {
	AccountID string
	Scope     string
	Challenge string
	Expires   time.Time
}

// This matches the current single-process deployment. Restarting the process
// invalidates pending flows/codes safely; scaling requires a shared atomic store.
type GoogleAuth struct {
	Provider     GoogleIdentityProvider
	mutex        sync.Mutex
	transactions map[string]googleTransaction
	requests     map[string]authorizationRequest
	now          func() time.Time
}

func NewGoogleAuth(provider GoogleIdentityProvider) (*GoogleAuth, error) {
	return &GoogleAuth{
		Provider:     provider,
		transactions: make(map[string]googleTransaction),
		requests:     make(map[string]authorizationRequest),
		now:          time.Now,
	}, nil
}

func randomSecret() (string, error) {
	var value [32]byte
	if _, err := rand.Read(value[:]); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(value[:]), nil
}

func challengeFor(verifier string) string {
	hash := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(hash[:])
}

func (auth *GoogleAuth) cleanup() {
	for key, value := range auth.transactions {
		if !auth.now().Before(value.Expires) {
			delete(auth.transactions, key)
		}
	}
	for key, value := range auth.requests {
		if !auth.now().Before(value.Expires) {
			delete(auth.requests, key)
		}
	}
}

// Only the initial request selects a provider. Completion and token redemption
// use the backend-issued code and do not require a provider from the browser.
func (handlers *Handlers) StartAuth(responseWriter http.ResponseWriter, request *http.Request) {
	if !googleProviderSelected(request) {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorInvalidRequest, "")
		return
	}
	query := request.URL.Query()
	if query.Get("redirect_uri") != handlers.FrontendAuthorizationRedirectURL.String() {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorInvalidRequest, "")
		return
	}
	handlers.startGoogle(responseWriter, request)
}

func googleProviderSelected(request *http.Request) bool {
	providers := request.URL.Query()["provider"]
	return len(providers) == 1 && providers[0] == "google"
}

// Scopes describe browser permissions. Account/subscription expiry does not
// gate scope issuance in the Google sign-in project.
func requestedBrowserScope(query url.Values) (string, bool) {
	values := query["scope"]
	if len(values) != 1 {
		return "", false
	}
	seen := make(map[string]bool)
	var scopes []string
	for _, scope := range strings.Split(values[0], " ") {
		if scope == "" {
			continue
		}
		if scope != "account" && scope != "monitor" {
			return "", false
		}
		if !seen[scope] {
			seen[scope] = true
			scopes = append(scopes, scope)
		}
	}
	return strings.Join(scopes, " "), len(scopes) > 0
}

func (handlers *Handlers) startGoogle(responseWriter http.ResponseWriter, request *http.Request) {
	auth := handlers.Google
	if auth == nil {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorProviderUnavailable, "")
		return
	}
	query := request.URL.Query()
	intent, state, challenge := query.Get("intent"), query.Get("state"), query.Get("code_challenge")
	if intent != "login" && intent != "signup" {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorInvalidRequest, "")
		return
	}
	if !pkceChallengePattern.MatchString(state) {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorInvalidRequest, "")
		return
	}
	if !pkceChallengePattern.MatchString(challenge) {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorInvalidRequest, "")
		return
	}
	if query.Get("code_challenge_method") != "S256" {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorInvalidRequest, "")
		return
	}
	if query.Get("client_id") != browserClientID {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorInvalidRequest, "")
		return
	}
	scope, ok := requestedBrowserScope(query)
	if !ok {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorInvalidRequest, "")
		return
	}
	transactionState, err := randomSecret()
	if err != nil {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorServerError, "")
		return
	}
	nonce, err := randomSecret()
	if err != nil {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorServerError, "")
		return
	}
	verifier, err := randomSecret()
	if err != nil {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorServerError, "")
		return
	}
	binding, err := randomSecret()
	if err != nil {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorServerError, "")
		return
	}
	transaction := googleTransaction{Intent: intent, Scope: scope, FrontendState: state, Challenge: challenge, Nonce: nonce, UpstreamVerifier: verifier, Binding: binding, Expires: auth.now().Add(googleTransactionTTL)}
	auth.mutex.Lock()
	auth.cleanup()
	if len(auth.transactions) >= maxPendingGoogleEntries {
		auth.mutex.Unlock()
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorTemporarilyUnavailable, "")
		return
	}
	auth.transactions[transactionState] = transaction
	auth.mutex.Unlock()
	// One cookie per flow supports independent tabs. Host-only and limited to
	// the callback; Lax allows Google's top-level GET to return this binding.
	http.SetCookie(responseWriter, &http.Cookie{Name: "__Secure-google-" + transactionState, Value: binding, Path: googleCallbackPath, Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: int(googleTransactionTTL.Seconds())})
	responseWriter.Header().Set("Cache-Control", "no-store")
	responseWriter.Header().Set("Referrer-Policy", "no-referrer")
	http.Redirect(responseWriter, request, auth.Provider.AuthorizationURL(transactionState, nonce, verifier), http.StatusSeeOther)
}

func (auth *GoogleAuth) takeTransaction(state, binding string) (googleTransaction, bool) {
	auth.mutex.Lock()
	defer auth.mutex.Unlock()
	auth.cleanup()
	transaction, ok := auth.transactions[state]
	if !ok || subtle.ConstantTimeCompare([]byte(transaction.Binding), []byte(binding)) != 1 {
		return googleTransaction{}, false
	}
	delete(auth.transactions, state)
	return transaction, true
}

func (handlers *Handlers) GoogleCallback(responseWriter http.ResponseWriter, request *http.Request) {
	auth := handlers.Google
	if auth == nil {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorProviderUnavailable, "")
		return
	}
	state := request.URL.Query().Get("state")
	if !pkceChallengePattern.MatchString(state) {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorInvalidRequest, "")
		return
	}
	cookieName := "__Secure-google-" + state
	cookie, err := request.Cookie(cookieName)
	if err != nil {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorInvalidRequest, "")
		return
	}
	transaction, ok := auth.takeTransaction(state, cookie.Value)
	if !ok {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorInvalidRequest, "")
		return
	}
	http.SetCookie(responseWriter, &http.Cookie{Name: cookieName, Path: googleCallbackPath, Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	if failure := request.URL.Query().Get("error"); failure != "" {
		errorCode := AuthorizationErrorAccessDenied
		if failure != "access_denied" {
			errorCode = AuthorizationErrorTemporarilyUnavailable
		}
		handlers.redirectAuthorizationFailure(responseWriter, request, errorCode, transaction.FrontendState)
		return
	}
	googleCode := request.URL.Query().Get("code")
	if googleCode == "" {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorTemporarilyUnavailable, transaction.FrontendState)
		return
	}
	ctx, cancel := context.WithTimeout(request.Context(), 20*time.Second)
	defer cancel()
	identity, err := auth.Provider.Exchange(ctx, googleCode, transaction.Nonce, transaction.UpstreamVerifier)
	if err != nil || identity == nil || identity.Issuer != GoogleIssuer || identity.Subject == "" || identity.Email == "" {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorTemporarilyUnavailable, transaction.FrontendState)
		return
	}
	account, err := handlers.AccountStore.GetByIdentity(ctx, identity.Issuer, identity.Subject)
	if transaction.Intent == "login" {
		if merry.HTTPCode(err) == http.StatusNotFound {
			handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorAccountNotFound, transaction.FrontendState)
			return
		}
	} else {
		if err == nil {
			handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorAccountAlreadyExists, transaction.FrontendState)
			return
		}
		if merry.HTTPCode(err) == http.StatusNotFound {
			account = &Account{ID: uuid.NewV4().String(), User: &User{ID: uuid.NewV4().String(), IdentityType: IdentityTypeExternal, ExternalIdentity: &ExternalIdentity{Issuer: identity.Issuer, Subject: identity.Subject, Email: identity.Email}}}
			data, marshalErr := json.Marshal(account)
			if marshalErr != nil {
				handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorServerError, transaction.FrontendState)
				return
			}
			err = handlers.AccountStore.Create(ctx, account, func() error {
				_, appendErr := handlers.EventLog.Append(ctx, eventlog.AppendInput{Type: EventTypeAccountCreated, Data: data})
				return appendErr
			})
			if merry.HTTPCode(err) == http.StatusConflict {
				handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorAccountAlreadyExists, transaction.FrontendState)
				return
			}
		}
	}
	if err != nil {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorServerError, transaction.FrontendState)
		return
	}
	code, err := randomSecret()
	if err != nil {
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorServerError, transaction.FrontendState)
		return
	}
	auth.mutex.Lock()
	auth.cleanup()
	if len(auth.requests) >= maxPendingGoogleEntries {
		auth.mutex.Unlock()
		handlers.redirectAuthorizationFailure(responseWriter, request, AuthorizationErrorTemporarilyUnavailable, transaction.FrontendState)
		return
	}
	auth.requests[code] = authorizationRequest{AccountID: account.ID, Scope: transaction.Scope, Challenge: transaction.Challenge, Expires: auth.now().Add(authorizationCodeTTL)}
	auth.mutex.Unlock()
	handlers.redirectAuthorizationSuccess(responseWriter, request, transaction.FrontendState, code)
}

func (auth *GoogleAuth) redeem(code, verifier, clientID string) (authorizationRequest, bool) {
	auth.mutex.Lock()
	defer auth.mutex.Unlock()
	auth.cleanup()
	entry, ok := auth.requests[code]
	if !ok {
		return authorizationRequest{}, false
	}
	if clientID != browserClientID {
		return authorizationRequest{}, false
	}
	if !pkceVerifierPattern.MatchString(verifier) {
		return authorizationRequest{}, false
	}
	if subtle.ConstantTimeCompare([]byte(entry.Challenge), []byte(challengeFor(verifier))) != 1 {
		return authorizationRequest{}, false
	}
	delete(auth.requests, code)
	return entry, true
}

func (handlers *Handlers) GetTokenUsingAuthorizationCode(responseWriter http.ResponseWriter, request *http.Request) {
	responseWriter.Header().Set("Cache-Control", "no-store")
	responseWriter.Header().Set("Pragma", "no-cache")
	if handlers.Google == nil {
		tokenError(responseWriter, "invalid_grant")
		return
	}
	// The registered browser origin is the only origin allowed to establish
	// this cookie-backed browser session. Native clients are outside this flow.
	redirectURL := handlers.FrontendAuthorizationRedirectURL
	if request.Header.Get("Origin") != redirectURL.Scheme+"://"+redirectURL.Host {
		tokenError(responseWriter, "invalid_request")
		return
	}
	request.Body = http.MaxBytesReader(responseWriter, request.Body, 8192)
	if err := request.ParseForm(); err != nil {
		tokenError(responseWriter, "invalid_request")
		return
	}
	if handlers.FrontendAuthorizationRedirectURL.String() != request.PostForm.Get("redirect_uri") {
		tokenError(responseWriter, "invalid_request")
		return
	}
	authorizationRequest, ok := handlers.Google.redeem(request.PostForm.Get("code"), request.PostForm.Get("code_verifier"), request.PostForm.Get("client_id"))
	if !ok {
		tokenError(responseWriter, "invalid_grant")
		return
	}
	account, err := handlers.AccountStore.Get(request.Context(), authorizationRequest.AccountID)
	if err != nil {
		tokenError(responseWriter, "invalid_grant")
		return
	}
	http.SetCookie(responseWriter, handlers.createRefreshTokenCookie(account))
	responseWriter.Header().Set("Content-Type", "application/json")
	json.NewEncoder(responseWriter).Encode(AccessTokenOutput{
		TokenType:   "Bearer",
		AccessToken: handlers.createAccessToken(account),
		ExpiresIn:   int(handlers.AccessTokenDuration.Seconds()),
	})
}

// Optional configuration: partial configuration fails startup rather than
// presenting a login button that cannot complete.
func GoogleAuthFromEnvironment(getenv func(string) string) (*GoogleAuth, error) {
	clientID, secret := getenv("GOOGLE_CLIENT_ID"), getenv("GOOGLE_CLIENT_SECRET")
	origin := getenv("API_ORIGIN")
	if clientID == "" && secret == "" {
		return nil, nil
	}
	if clientID == "" || secret == "" || origin == "" {
		return nil, errors.New("Google authentication requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and API_ORIGIN")
	}
	u, err := url.Parse(origin)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || (u.Path != "" && u.Path != "/") || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || strings.Contains(u.Host, " ") {
		return nil, errors.New("API_ORIGIN must be an HTTPS origin")
	}
	u.Path = googleCallbackPath
	return NewGoogleAuth(NewGoogleIdentityProvider(clientID, secret, u.String()))
}
