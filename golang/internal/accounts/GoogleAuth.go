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
	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
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

type authorizationCode struct {
	AccountID, Scope, Challenge string
	Expires                     time.Time
}

// This matches the current single-process deployment. Restarting the process
// invalidates pending flows/codes safely; scaling requires a shared atomic store.
type GoogleAuth struct {
	Provider     GoogleIdentityProvider
	RedirectURI  string
	mutex        sync.Mutex
	transactions map[string]googleTransaction
	codes        map[string]authorizationCode
	now          func() time.Time
}

func NewGoogleAuth(provider GoogleIdentityProvider, frontendRedirect string) (*GoogleAuth, error) {
	u, err := url.Parse(frontendRedirect)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || u.Path == "" || u.Path == "/" || strings.Contains(u.Host, " ") {
		return nil, errors.New("FRONTEND_AUTH_REDIRECT must be an HTTPS callback URL without query parameters or fragment")
	}
	return &GoogleAuth{Provider: provider, RedirectURI: u.String(), transactions: make(map[string]googleTransaction), codes: make(map[string]authorizationCode), now: time.Now}, nil
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
	for key, value := range auth.codes {
		if !auth.now().Before(value.Expires) {
			delete(auth.codes, key)
		}
	}
}

func authError(w http.ResponseWriter, code string, status int) {
	w.Header().Set("Cache-Control", "no-store")
	httpx.Error(w, httpx.ErrorWithCode(merry.New(code).WithHTTPCode(status).WithUserMessage(code), code))
}

func (handlers *Handlers) AuthConfig(w http.ResponseWriter, r *http.Request) {
	if !googleProviderSelected(r) {
		authError(w, "invalid_provider", http.StatusBadRequest)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(struct {
		Enabled bool `json:"enabled"`
	}{handlers.Google != nil})
}

// Only the initial request selects a provider. Completion and token redemption
// use the backend-issued code and do not require a provider from the browser.
func (handlers *Handlers) StartAuth(w http.ResponseWriter, r *http.Request) {
	if !googleProviderSelected(r) {
		authError(w, "invalid_provider", http.StatusBadRequest)
		return
	}
	handlers.startGoogle(w, r)
}

func googleProviderSelected(r *http.Request) bool {
	providers := r.URL.Query()["provider"]
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

func (handlers *Handlers) startGoogle(w http.ResponseWriter, r *http.Request) {
	auth := handlers.Google
	if auth == nil {
		authError(w, "google_unavailable", http.StatusServiceUnavailable)
		return
	}
	q := r.URL.Query()
	intent, state, challenge := q.Get("intent"), q.Get("state"), q.Get("code_challenge")
	if (intent != "login" && intent != "signup") || !pkceChallengePattern.MatchString(state) || !pkceChallengePattern.MatchString(challenge) || q.Get("code_challenge_method") != "S256" || q.Get("client_id") != browserClientID || q.Get("redirect_uri") != auth.RedirectURI {
		authError(w, "invalid_request", http.StatusBadRequest)
		return
	}
	scope, ok := requestedBrowserScope(q)
	if !ok {
		authError(w, "invalid_scope", http.StatusBadRequest)
		return
	}
	transactionState, err := randomSecret()
	if err != nil {
		authError(w, "server_error", http.StatusInternalServerError)
		return
	}
	nonce, err := randomSecret()
	if err != nil {
		authError(w, "server_error", http.StatusInternalServerError)
		return
	}
	verifier, err := randomSecret()
	if err != nil {
		authError(w, "server_error", http.StatusInternalServerError)
		return
	}
	binding, err := randomSecret()
	if err != nil {
		authError(w, "server_error", http.StatusInternalServerError)
		return
	}
	transaction := googleTransaction{Intent: intent, Scope: scope, FrontendState: state, Challenge: challenge, Nonce: nonce, UpstreamVerifier: verifier, Binding: binding, Expires: auth.now().Add(googleTransactionTTL)}
	auth.mutex.Lock()
	auth.cleanup()
	if len(auth.transactions) >= maxPendingGoogleEntries {
		auth.mutex.Unlock()
		authError(w, "temporarily_unavailable", http.StatusServiceUnavailable)
		return
	}
	auth.transactions[transactionState] = transaction
	auth.mutex.Unlock()
	// One cookie per flow supports independent tabs. Host-only and limited to
	// the callback; Lax allows Google's top-level GET to return this binding.
	http.SetCookie(w, &http.Cookie{Name: "__Secure-google-" + transactionState, Value: binding, Path: googleCallbackPath, Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: int(googleTransactionTTL.Seconds())})
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	http.Redirect(w, r, auth.Provider.AuthorizationURL(transactionState, nonce, verifier), http.StatusSeeOther)
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

func (auth *GoogleAuth) redirect(w http.ResponseWriter, r *http.Request, transaction googleTransaction, code, failure string) {
	u, _ := url.Parse(auth.RedirectURI)
	q := u.Query()
	q.Set("state", transaction.FrontendState)
	if failure != "" {
		q.Set("error", failure)
	} else {
		q.Set("code", code)
	}
	u.RawQuery = q.Encode()
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Referrer-Policy", "no-referrer")
	http.Redirect(w, r, u.String(), http.StatusSeeOther)
}

func (handlers *Handlers) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	auth := handlers.Google
	if auth == nil {
		authError(w, "google_unavailable", http.StatusServiceUnavailable)
		return
	}
	state := r.URL.Query().Get("state")
	if !pkceChallengePattern.MatchString(state) {
		authError(w, "invalid_state", http.StatusBadRequest)
		return
	}
	cookieName := "__Secure-google-" + state
	cookie, err := r.Cookie(cookieName)
	if err != nil {
		authError(w, "invalid_state", http.StatusBadRequest)
		return
	}
	transaction, ok := auth.takeTransaction(state, cookie.Value)
	if !ok {
		authError(w, "invalid_state", http.StatusBadRequest)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: cookieName, Path: googleCallbackPath, Secure: true, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	if failure := r.URL.Query().Get("error"); failure != "" {
		if failure != "access_denied" {
			failure = "authentication_failed"
		}
		auth.redirect(w, r, transaction, "", failure)
		return
	}
	googleCode := r.URL.Query().Get("code")
	if googleCode == "" {
		auth.redirect(w, r, transaction, "", "authentication_failed")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	identity, err := auth.Provider.Exchange(ctx, googleCode, transaction.Nonce, transaction.UpstreamVerifier)
	if err != nil || identity == nil || identity.Issuer != GoogleIssuer || identity.Subject == "" || identity.Email == "" {
		auth.redirect(w, r, transaction, "", "authentication_failed")
		return
	}
	account, err := handlers.AccountStore.GetByIdentity(ctx, identity.Issuer, identity.Subject)
	if transaction.Intent == "login" {
		if merry.HTTPCode(err) == http.StatusNotFound {
			auth.redirect(w, r, transaction, "", "account_not_found")
			return
		}
	} else {
		if err == nil {
			auth.redirect(w, r, transaction, "", "account_already_exists")
			return
		}
		if merry.HTTPCode(err) == http.StatusNotFound {
			account = &Account{ID: uuid.NewV4().String(), User: &User{ID: uuid.NewV4().String(), Identity: &ExternalIdentity{Issuer: identity.Issuer, Subject: identity.Subject, Email: identity.Email}}}
			data, marshalErr := json.Marshal(account)
			if marshalErr != nil {
				auth.redirect(w, r, transaction, "", "server_error")
				return
			}
			err = handlers.AccountStore.Create(ctx, account, func() error {
				_, appendErr := handlers.EventLog.Append(ctx, eventlog.AppendInput{Type: EventTypeAccountCreated, Data: data})
				return appendErr
			})
			if merry.HTTPCode(err) == http.StatusConflict {
				auth.redirect(w, r, transaction, "", "account_already_exists")
				return
			}
		}
	}
	if err != nil {
		auth.redirect(w, r, transaction, "", "server_error")
		return
	}
	code, err := randomSecret()
	if err != nil {
		auth.redirect(w, r, transaction, "", "server_error")
		return
	}
	auth.mutex.Lock()
	auth.cleanup()
	if len(auth.codes) >= maxPendingGoogleEntries {
		auth.mutex.Unlock()
		auth.redirect(w, r, transaction, "", "temporarily_unavailable")
		return
	}
	auth.codes[code] = authorizationCode{AccountID: account.ID, Scope: transaction.Scope, Challenge: transaction.Challenge, Expires: auth.now().Add(authorizationCodeTTL)}
	auth.mutex.Unlock()
	auth.redirect(w, r, transaction, code, "")
}

func (auth *GoogleAuth) redeem(code, verifier, clientID, redirectURI string) (authorizationCode, bool) {
	auth.mutex.Lock()
	defer auth.mutex.Unlock()
	auth.cleanup()
	entry, ok := auth.codes[code]
	if !ok || clientID != browserClientID || redirectURI != auth.RedirectURI || !pkceVerifierPattern.MatchString(verifier) || subtle.ConstantTimeCompare([]byte(entry.Challenge), []byte(challengeFor(verifier))) != 1 {
		return authorizationCode{}, false
	}
	delete(auth.codes, code)
	return entry, true
}

func (handlers *Handlers) GetTokenUsingAuthorizationCode(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Pragma", "no-cache")
	if handlers.Google == nil {
		authError(w, "invalid_grant", http.StatusBadRequest)
		return
	}
	// The registered browser origin is the only origin allowed to establish
	// this cookie-backed browser session. Native clients are outside this flow.
	u, _ := url.Parse(handlers.Google.RedirectURI)
	if r.Header.Get("Origin") != u.Scheme+"://"+u.Host {
		authError(w, "invalid_request", http.StatusBadRequest)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 8192)
	if err := r.ParseForm(); err != nil {
		authError(w, "invalid_request", http.StatusBadRequest)
		return
	}
	grant, ok := handlers.Google.redeem(r.PostForm.Get("code"), r.PostForm.Get("code_verifier"), r.PostForm.Get("client_id"), r.PostForm.Get("redirect_uri"))
	if !ok {
		authError(w, "invalid_grant", http.StatusBadRequest)
		return
	}
	account, err := handlers.AccountStore.Get(r.Context(), grant.AccountID)
	if err != nil {
		authError(w, "invalid_grant", http.StatusBadRequest)
		return
	}
	http.SetCookie(w, handlers.createRefreshTokenCookie(account, grant.Scope))
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(AccessTokenOutput{TokenType: "Bearer", AccessToken: handlers.createAccessToken(account, grant.Scope), ExpiresIn: int(handlers.AccessTokenDuration.Seconds())})
}

// Optional configuration: partial configuration fails startup rather than
// presenting a login button that cannot complete.
func GoogleAuthFromEnvironment(getenv func(string) string) (*GoogleAuth, error) {
	clientID, secret := getenv("GOOGLE_CLIENT_ID"), getenv("GOOGLE_CLIENT_SECRET")
	origin, frontend := getenv("API_ORIGIN"), getenv("FRONTEND_AUTH_REDIRECT")
	if clientID == "" && secret == "" && frontend == "" {
		return nil, nil
	}
	if clientID == "" || secret == "" || origin == "" || frontend == "" {
		return nil, errors.New("Google authentication requires GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, API_ORIGIN and FRONTEND_AUTH_REDIRECT")
	}
	u, err := url.Parse(origin)
	if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || (u.Path != "" && u.Path != "/") || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || strings.Contains(u.Host, " ") {
		return nil, errors.New("API_ORIGIN must be an HTTPS origin")
	}
	u.Path = googleCallbackPath
	return NewGoogleAuth(NewGoogleIdentityProvider(clientID, secret, u.String()), frontend)
}
