package accounts

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal"

	"github.com/ansel1/merry"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/store"
)

type fakeGoogleProvider struct {
	identity GoogleIdentity
	fail     bool
	called   atomic.Int32
}

func (provider *fakeGoogleProvider) AuthorizationURL(state, nonce, verifier string) string {
	return "https://google.example/auth?" + url.Values{"state": {state}, "nonce": {nonce}, "code_challenge": {challengeFor(verifier)}}.Encode()
}
func (provider *fakeGoogleProvider) Exchange(_ context.Context, code, nonce, verifier string) (*GoogleIdentity, error) {
	provider.called.Add(1)
	if provider.fail || code != "google-code" || nonce == "" || verifier == "" {
		return nil, errors.New("invalid Google response")
	}
	return &provider.identity, nil
}

type recordedAccountLog struct {
	mutex  sync.Mutex
	events []*eventlog.Event
}

func (log *recordedAccountLog) Append(_ context.Context, input eventlog.AppendInput) (*eventlog.Event, error) {
	log.mutex.Lock()
	defer log.mutex.Unlock()
	event := &eventlog.Event{Type: input.Type, Data: input.Data, LogicalClock: int64(len(log.events) + 1)}
	log.events = append(log.events, event)
	return event, nil
}
func (*recordedAccountLog) GetEventIterator(context.Context, eventlog.GetEventIteratorInput) eventlog.EventIterator {
	return &eventlog.NullEventIterator{}
}
func (*recordedAccountLog) Wait(context.Context) <-chan struct{} { return make(chan struct{}) }

func googleTestHandlers(t *testing.T) (*Handlers, http.Handler, *fakeGoogleProvider, *recordedAccountLog) {
	t.Helper()
	provider := &fakeGoogleProvider{identity: GoogleIdentity{Issuer: GoogleIssuer, Subject: "opaque:Google/Subject+01", Email: "same@example.com"}}
	auth, err := NewGoogleAuth(provider)
	if err != nil {
		t.Fatal(err)
	}
	log := &recordedAccountLog{}
	handlers := &Handlers{
		FrontendAuthorizationRedirectURL: url.URL{
			Scheme: "https",
			Host:   "app.example.com",
			Path:   "/auth/callback",
		},
		Google:               auth,
		AccountStore:         &AccountStore{Store: store.NewMemoryStore()},
		EventLog:             log,
		Key:                  []byte("test-key"),
		SigningMethod:        jwt.SigningMethodHS256,
		AccessTokenDuration:  time.Hour,
		RefreshTokenDuration: time.Hour,
		UsedTokens:           NewUsedTokens(),
	}
	router := mux.NewRouter()
	handlers.AddRoutes(router)
	return handlers, router, provider, log
}

type startedGoogleFlow struct {
	verifier, state, frontendState string
	cookie                         *http.Cookie
}

func beginGoogle(t *testing.T, router http.Handler, intent string) startedGoogleFlow {
	return beginGoogleWithScope(t, router, intent, "account monitor")
}

func beginGoogleWithScope(t *testing.T, router http.Handler, intent, scope string) startedGoogleFlow {
	t.Helper()
	verifier, _ := randomSecret()
	frontendState, _ := randomSecret()
	query := url.Values{"provider": {"google"}, "intent": {intent}, "scope": {scope}, "state": {frontendState}, "code_challenge": {challengeFor(verifier)}, "code_challenge_method": {"S256"}, "client_id": {browserClientID}, "redirect_uri": {"https://app.example.com/auth/callback"}}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/auth/start?"+query.Encode(), nil))
	if w.Code != http.StatusSeeOther {
		t.Fatalf("start: %d %s", w.Code, w.Body.String())
	}
	redirect, _ := url.Parse(w.Header().Get("Location"))
	cookies := w.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].Secure || !cookies[0].HttpOnly || cookies[0].SameSite != http.SameSiteLaxMode || cookies[0].Domain != "" {
		t.Fatal("missing secure callback binding")
	}
	return startedGoogleFlow{verifier: verifier, state: redirect.Query().Get("state"), frontendState: frontendState, cookie: cookies[0]}
}
func callbackGoogle(router http.Handler, flow startedGoogleFlow, extra string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("GET", "/auth/google/callback?code=google-code&state="+flow.state+extra, nil)
	r.AddCookie(flow.cookie)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, r)
	return w
}
func callbackValues(t *testing.T, w *httptest.ResponseRecorder) url.Values {
	t.Helper()
	if w.Code != http.StatusSeeOther && w.Code != http.StatusFound {
		t.Fatalf("callback: %d %s", w.Code, w.Body.String())
	}
	u, err := url.Parse(w.Header().Get("Location"))
	if err != nil {
		t.Fatal(err)
	}
	if u.Scheme+"://"+u.Host+u.Path != "https://app.example.com/auth/callback" {
		t.Fatal("unregistered redirect")
	}
	if (u.Query().Get("error") == "" && w.Code != http.StatusSeeOther) || (u.Query().Get("error") != "" && w.Code != http.StatusFound) {
		t.Fatal("wrong success/failure redirect status")
	}
	return u.Query()
}
func exchangeBeddybytes(router http.Handler, code, verifier string) *httptest.ResponseRecorder {
	r := httptest.NewRequest("POST", "/token", strings.NewReader(url.Values{"grant_type": {"authorization_code"}, "code": {code}, "code_verifier": {verifier}, "client_id": {browserClientID}, "redirect_uri": {"https://app.example.com/auth/callback"}}.Encode()))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	r.Header.Set("Origin", "https://app.example.com")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, r)
	return w
}

func TestGoogleSignupLoginUsesOpaqueSubjectAndStoresEmail(t *testing.T) {
	handlers, router, provider, log := googleTestHandlers(t)
	ctx := context.Background()
	passwordAccount := &Account{ID: "password-account", User: NewInternalIdentityUser(&NewInternalIdentityUserInput{Email: "same@example.com", Password: "long-enough-password-for-tests"})}
	if err := handlers.AccountStore.Put(ctx, passwordAccount); err != nil {
		t.Fatal(err)
	}
	flow := beginGoogle(t, router, "signup")
	params := callbackValues(t, callbackGoogle(router, flow, "&intent=login"))
	if params.Get("state") != flow.frontendState || params.Get("code") == "" || params.Get("error") != "" {
		t.Fatalf("bad signup result: %v", params)
	}
	if len(log.events) != 1 {
		t.Fatal("signup did not append exactly one event")
	}
	googleAccount, err := handlers.AccountStore.GetByIdentity(ctx, GoogleIssuer, provider.identity.Subject)
	if err != nil || googleAccount.ID == passwordAccount.ID || googleAccount.User.InternalIdentity != nil || googleAccount.User.ExternalIdentity == nil || googleAccount.User.ExternalIdentity.Subject != provider.identity.Subject || googleAccount.User.ExternalIdentity.Email != "same@example.com" {
		t.Fatal("accounts not independent")
	}
	legacy, err := handlers.AccountStore.GetByEmail(ctx, "same@example.com")
	if err != nil || legacy.ID != passwordAccount.ID {
		t.Fatal("Google overwrote password email index")
	}
	w := exchangeBeddybytes(router, params.Get("code"), flow.verifier)
	if w.Code != http.StatusOK {
		t.Fatalf("exchange: %d %s", w.Code, w.Body.String())
	}
	if w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("token response may be cached")
	}
	var token AccessTokenOutput
	if err := json.Unmarshal(w.Body.Bytes(), &token); err != nil {
		t.Fatal(err)
	}
	if token.TokenType != "Bearer" || token.AccessToken == "" || token.ExpiresIn != 3600 {
		t.Fatal("wrong token response")
	}
	if len(w.Result().Cookies()) != 1 || !w.Result().Cookies()[0].HttpOnly || !w.Result().Cookies()[0].Secure {
		t.Fatal("missing refresh cookie")
	}
	r := httptest.NewRequest("GET", "/accounts/current", nil)
	r.Header.Set("Authorization", "Bearer "+token.AccessToken)
	current := httptest.NewRecorder()
	router.ServeHTTP(current, r)
	var currentAccount Account
	json.Unmarshal(current.Body.Bytes(), &currentAccount)
	if current.Code != 200 || currentAccount.ID != googleAccount.ID || currentAccount.User.ExternalIdentity == nil || currentAccount.User.ExternalIdentity.Email != "same@example.com" {
		t.Fatal("token does not resolve new account")
	}
	if exchangeBeddybytes(router, params.Get("code"), flow.verifier).Code != 400 {
		t.Fatal("code could be reused")
	}
	loginFlow := beginGoogle(t, router, "login")
	loginParams := callbackValues(t, callbackGoogle(router, loginFlow, ""))
	if loginParams.Get("code") == "" || len(log.events) != 1 {
		t.Fatal("repeat login created an account")
	}
	grant, ok := handlers.Google.redeem(loginParams.Get("code"), loginFlow.verifier, browserClientID)
	if !ok || grant.AccountID != googleAccount.ID {
		t.Fatal("opaque subject did not resolve the same Google identity")
	}
	if err := handlers.AccountStore.Remove(ctx, googleAccount.ID); err != nil {
		t.Fatal(err)
	}
	legacy, err = handlers.AccountStore.GetByEmail(ctx, "same@example.com")
	if err != nil || legacy.ID != passwordAccount.ID {
		t.Fatal("Google deletion deleted password account")
	}
}

func TestGoogleLoginNeverCreatesAndSignupDoesNotLoginExistingIdentity(t *testing.T) {
	handlers, router, _, log := googleTestHandlers(t)
	flow := beginGoogle(t, router, "login")
	params := callbackValues(t, callbackGoogle(router, flow, "&intent=signup"))
	if params.Get("error") != "account_not_found" || params.Get("code") != "" || len(log.events) != 0 {
		t.Fatal("login implicitly created account")
	}
	flow = beginGoogle(t, router, "signup")
	if callbackValues(t, callbackGoogle(router, flow, "")).Get("code") == "" {
		t.Fatal("signup failed")
	}
	flow = beginGoogle(t, router, "signup")
	params = callbackValues(t, callbackGoogle(router, flow, ""))
	if params.Get("error") != "account_already_exists" || params.Get("code") != "" || len(log.events) != 1 {
		t.Fatal("signup implicitly signed in existing account")
	}
	if _, err := handlers.AccountStore.GetByEmail(context.Background(), "same@example.com"); merry.HTTPCode(err) != 404 {
		t.Fatal("Google-only account entered password lookup")
	}
	w := httptest.NewRecorder()
	r := httptest.NewRequest("POST", "/token", strings.NewReader("grant_type=password&username=same%40example.com&password=anything"))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	router.ServeHTTP(w, r)
	if w.Code != 401 {
		t.Fatal("Google-only account accepted password login")
	}
	if err := handlers.AccountStore.UpdatePassword(context.Background(), &UpdatePasswordInput{Email: "same@example.com"}); merry.HTTPCode(err) != 404 {
		t.Fatal("Google-only account accepted password reset")
	}
}

func TestGoogleCallbackBindingExpiryAndCancellation(t *testing.T) {
	for _, mode := range []string{"no_cookie", "wrong_cookie", "expired", "replay", "cancel", "provider_failure"} {
		t.Run(mode, func(t *testing.T) {
			handlers, router, provider, log := googleTestHandlers(t)
			flow := beginGoogle(t, router, "signup")
			r := httptest.NewRequest("GET", "/auth/google/callback?code=google-code&state="+flow.state, nil)
			switch mode {
			case "no_cookie":
			case "wrong_cookie":
				flow.cookie.Value = "wrong"
				r.AddCookie(flow.cookie)
			case "expired":
				handlers.Google.now = func() time.Time { return time.Now().Add(11 * time.Minute) }
				r.AddCookie(flow.cookie)
			case "replay":
				callbackGoogle(router, flow, "")
				r.AddCookie(flow.cookie)
			case "cancel":
				r.URL.RawQuery += "&error=access_denied"
				r.AddCookie(flow.cookie)
			case "provider_failure":
				provider.fail = true
				r.AddCookie(flow.cookie)
			}
			w := httptest.NewRecorder()
			router.ServeHTTP(w, r)
			if mode == "cancel" || mode == "provider_failure" {
				params := callbackValues(t, w)
				if params.Get("error") == "" || params.Get("state") != flow.frontendState || params.Get("code") != "" || len(log.events) != 0 {
					t.Fatal("failed authentication created account")
				}
			} else if params := callbackValues(t, w); params.Get("error") != string(AuthorizationErrorInvalidRequest) || params.Get("code") != "" || params.Get("state") != "" {
				t.Fatal("invalid callback was not rejected without a bound frontend state")
			}
			if mode != "replay" && mode != "provider_failure" && provider.called.Load() != 0 {
				t.Fatal("provider called before validating transaction")
			}
		})
	}
}

func TestAuthorizationCodeBindingsExpiryAndAtomicConsumption(t *testing.T) {
	for _, mode := range []string{"wrong_verifier", "wrong_client", "expired", "concurrent"} {
		t.Run(mode, func(t *testing.T) {
			handlers, router, _, _ := googleTestHandlers(t)
			flow := beginGoogle(t, router, "signup")
			code := callbackValues(t, callbackGoogle(router, flow, "")).Get("code")
			verifier, client := flow.verifier, browserClientID
			switch mode {
			case "wrong_verifier":
				verifier, _ = randomSecret()
			case "wrong_client":
				client = "attacker"
			case "expired":
				handlers.Google.now = func() time.Time { return time.Now().Add(2 * time.Minute) }
			case "concurrent":
				var successes atomic.Int32
				var wg sync.WaitGroup
				for i := 0; i < 20; i++ {
					wg.Add(1)
					go func() {
						defer wg.Done()
						if _, ok := handlers.Google.redeem(code, verifier, client); ok {
							successes.Add(1)
						}
					}()
				}
				wg.Wait()
				if successes.Load() != 1 {
					t.Fatal("code was not consumed exactly once")
				}
				return
			}
			if _, ok := handlers.Google.redeem(code, verifier, client); ok {
				t.Fatal("invalid redemption accepted")
			}
			if mode != "expired" {
				if _, ok := handlers.Google.redeem(code, flow.verifier, browserClientID); !ok {
					t.Fatal("invalid request consumed valid code")
				}
			}
		})
	}
}

func TestAuthorizationCodeRedirectBindingIsCheckedByHandlers(t *testing.T) {
	_, router, _, _ := googleTestHandlers(t)
	flow := beginGoogle(t, router, "signup")
	code := callbackValues(t, callbackGoogle(router, flow, "")).Get("code")
	for _, redirect := range []string{"", "https://evil.example/auth/callback", "https://app.example.com/auth/callback?attacker=true"} {
		request := httptest.NewRequest(http.MethodPost, "/token", strings.NewReader(url.Values{
			"grant_type": {"authorization_code"}, "code": {code}, "code_verifier": {flow.verifier},
			"client_id": {browserClientID}, "redirect_uri": {redirect},
		}.Encode()))
		request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		request.Header.Set("Origin", "https://app.example.com")
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		if response.Code != http.StatusBadRequest || response.Header().Get("Location") != "" || len(response.Result().Cookies()) != 0 || !strings.Contains(response.Header().Get("Content-Type"), "application/json") {
			t.Fatal("invalid redirect did not return a JSON error without establishing a session")
		}
	}
	if exchangeBeddybytes(router, code, flow.verifier).Code != http.StatusOK {
		t.Fatal("invalid redirect consumed the valid authorization code")
	}
}

func TestGoogleSignupConcurrentUniquenessAndEventReplay(t *testing.T) {
	_, router, _, log := googleTestHandlers(t)
	flows := make([]startedGoogleFlow, 12)
	for i := range flows {
		flows[i] = beginGoogle(t, router, "signup")
	}
	var success atomic.Int32
	var wg sync.WaitGroup
	for _, flow := range flows {
		wg.Add(1)
		go func(flow startedGoogleFlow) {
			defer wg.Done()
			w := callbackGoogle(router, flow, "")
			u, _ := url.Parse(w.Header().Get("Location"))
			if u.Query().Get("code") != "" {
				success.Add(1)
			}
		}(flow)
	}
	wg.Wait()
	if success.Load() != 1 || len(log.events) != 1 {
		t.Fatal("parallel signup created duplicate identities")
	}
	replayed := &Handlers{AccountStore: &AccountStore{Store: store.NewMemoryStore()}}
	for _, event := range log.events {
		replayed.ApplyEvent(context.Background(), event)
		replayed.ApplyEvent(context.Background(), event)
	}
	a, err := replayed.AccountStore.GetByIdentity(context.Background(), GoogleIssuer, "opaque:Google/Subject+01")
	if err != nil || a.User.InternalIdentity != nil || a.User.ExternalIdentity == nil || a.User.ExternalIdentity.Subject != "opaque:Google/Subject+01" || a.User.ExternalIdentity.Email != "same@example.com" {
		t.Fatal("provider identity lost on event replay")
	}
}

func TestGoogleConfigurationAndStartValidation(t *testing.T) {
	if auth, err := GoogleAuthFromEnvironment(func(string) string { return "" }); err != nil || auth != nil {
		t.Fatal("disabled Google requires configuration")
	}
	if _, err := GoogleAuthFromEnvironment(func(key string) string {
		if key == "GOOGLE_CLIENT_ID" {
			return "id"
		}
		return ""
	}); err == nil {
		t.Fatal("partial config accepted")
	}
	_, router, _, _ := googleTestHandlers(t)
	for _, query := range []string{"provider=google&intent=link", "provider=google&intent=login&redirect_uri=https://evil.example", "provider=google&intent=signup&code_challenge_method=plain"} {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest("GET", "/auth/start?"+query, nil))
		if params := callbackValues(t, w); params.Get("error") != string(AuthorizationErrorInvalidRequest) || params.Get("code") != "" || len(w.Result().Cookies()) != 0 {
			t.Fatal("invalid start created an authorization transaction")
		}
	}
	flow := beginGoogle(t, router, "signup")
	code := callbackValues(t, callbackGoogle(router, flow, "")).Get("code")
	r := httptest.NewRequest("POST", "/token", strings.NewReader("grant_type=authorization_code&code="+code))
	r.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	r.Header.Set("Origin", "https://evil.example")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, r)
	if w.Code != 400 || len(w.Result().Cookies()) != 0 {
		t.Fatal("unregistered origin established session")
	}
	if exchangeBeddybytes(router, code, flow.verifier).Code != 200 {
		t.Fatal("bad origin consumed code")
	}
}

func TestAuthProviderSelection(t *testing.T) {
	handlers, router, _, _ := googleTestHandlers(t)
	for _, query := range []string{"", "provider=", "provider=unknown", "provider=https://evil.example", "provider=google&provider=unknown", "provider=google&provider=google"} {
		w := httptest.NewRecorder()
		router.ServeHTTP(w, httptest.NewRequest("GET", "/auth/start?"+query, nil))
		if params := callbackValues(t, w); params.Get("error") != string(AuthorizationErrorInvalidRequest) || len(w.Result().Cookies()) != 0 {
			t.Fatal("invalid provider accepted")
		}
	}
	handlers.Google = nil
	w := httptest.NewRecorder()
	router.ServeHTTP(w, httptest.NewRequest("GET", "/auth/start?provider=google&redirect_uri="+url.QueryEscape(handlers.FrontendAuthorizationRedirectURL.String()), nil))
	if callbackValues(t, w).Get("error") != string(AuthorizationErrorProviderUnavailable) {
		t.Fatal("unconfigured provider accepted")
	}
}

func TestGoogleCallbackDerivedFromAPIOrigin(t *testing.T) {
	for _, origin := range []string{"https://api.example.com", "https://api.qa.example.com/", "https://api.example.com:8443"} {
		auth, err := GoogleAuthFromEnvironment(func(key string) string {
			return map[string]string{
				"API_ORIGIN": origin, "GOOGLE_CLIENT_ID": "id", "GOOGLE_CLIENT_SECRET": "secret",
			}[key]
		})
		if err != nil {
			t.Fatal(err)
		}
		callback := auth.Provider.(*googleOIDCProvider).config.RedirectURL
		if callback != strings.TrimSuffix(origin, "/")+googleCallbackPath {
			t.Fatal("Google redirect did not use the router callback path")
		}
	}
	for _, origin := range []string{"http://api.example.com", "https://api.example.com/wrong-path", "https://api.example.com?", "https://api.example.com?next=evil", "https://api.example.com#fragment", "https://user:pass@api.example.com"} {
		_, err := GoogleAuthFromEnvironment(func(key string) string {
			return map[string]string{
				"API_ORIGIN": origin, "GOOGLE_CLIENT_ID": "id", "GOOGLE_CLIENT_SECRET": "secret",
			}[key]
		})
		if err == nil {
			t.Fatal("invalid API origin accepted")
		}
	}
	if auth, err := GoogleAuthFromEnvironment(func(key string) string {
		if key == "API_ORIGIN" {
			return "https://api.example.com"
		}
		return ""
	}); err != nil || auth != nil {
		t.Fatal("generic API origin enabled Google without credentials")
	}
}

func TestGoogleScopesSurviveCodeExchangeAndRefresh(t *testing.T) {
	for _, scope := range []string{"account", "monitor", "account monitor"} {
		t.Run(scope, func(t *testing.T) {
			handlers, router, _, _ := googleTestHandlers(t)
			flow := beginGoogleWithScope(t, router, "signup", scope)
			code := callbackValues(t, callbackGoogle(router, flow, "")).Get("code")
			response := exchangeBeddybytes(router, code, flow.verifier)
			for rotation := 0; rotation < 3; rotation++ {
				if response.Code != http.StatusOK {
					t.Fatalf("token response failed: %d", response.Code)
				}
				var output AccessTokenOutput
				if err := json.Unmarshal(response.Body.Bytes(), &output); err != nil {
					t.Fatal(err)
				}
				var claims internal.Claims
				if _, err := jwt.ParseWithClaims(output.AccessToken, &claims, handlers.getKey); err != nil {
					t.Fatal(err)
				}
				if claims.TokenUse != internal.TokenUseAccess || claims.Scope != scope || claims.Expiry <= time.Now().Unix() || claims.Subject.AccountID == "" {
					t.Fatal("scope, account, or token expiration was lost")
				}
				var cookie *http.Cookie
				for _, candidate := range response.Result().Cookies() {
					if candidate.Name == "refresh_token" {
						cookie = candidate
					}
				}
				if cookie == nil || !cookie.HttpOnly || !cookie.Secure {
					t.Fatal("refresh cookie missing")
				}
				var refresh internal.Claims
				if _, err := jwt.ParseWithClaims(cookie.Value, &refresh, handlers.getKey); err != nil {
					t.Fatal(err)
				}
				if refresh.TokenUse != internal.TokenUseRefresh || refresh.Scope != scope {
					t.Fatal("refresh token type or scopes were lost")
				}
				request := httptest.NewRequest("POST", "/token", strings.NewReader("grant_type=refresh_token&scope=admin"))
				request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
				request.AddCookie(cookie)
				response = httptest.NewRecorder()
				router.ServeHTTP(response, request)
			}
		})
	}
}

func TestBrowserScopesRejectUnsupportedOrAmbiguousRequests(t *testing.T) {
	for _, query := range []url.Values{
		{}, {"scope": {""}}, {"scope": {"admin"}}, {"scope": {"account create_account"}},
		{"scope": {"account", "monitor"}}, {"scope": {"account\tmonitor"}},
	} {
		if _, ok := requestedBrowserScope(query); ok {
			t.Fatal("invalid scope accepted")
		}
	}
	if scope, ok := requestedBrowserScope(url.Values{"scope": {"account monitor account"}}); !ok || scope != "account monitor" {
		t.Fatal("supported scopes were not normalized")
	}
	_, router, _, _ := googleTestHandlers(t)
	query := url.Values{
		"provider": {"google"}, "intent": {"login"}, "state": {strings.Repeat("s", 43)},
		"code_challenge": {strings.Repeat("c", 43)}, "code_challenge_method": {"S256"},
		"client_id": {browserClientID}, "redirect_uri": {"https://app.example.com/auth/callback"}, "scope": {"admin"},
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest("GET", "/auth/start?"+query.Encode(), nil))
	if callbackValues(t, response).Get("error") != string(AuthorizationErrorInvalidRequest) || len(response.Result().Cookies()) != 0 {
		t.Fatal("unsupported scope started an authentication transaction")
	}
}
