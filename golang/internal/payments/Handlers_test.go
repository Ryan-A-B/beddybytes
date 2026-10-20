package payments

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/paymentrepository"
)

var _ Commands = (*paymentrepository.CommandHandler)(nil)

type commandStub struct {
	start  func(context.Context, paymentrepository.StartCheckoutSessionInput) (*paymentrepository.StartCheckoutSessionOutput, error)
	sync   func(context.Context, paymentrepository.SyncCheckoutSessionInput) error
	record func(context.Context, paymentrepository.RecordCheckoutSessionEventInput) error
}

func (stub *commandStub) StartCheckoutSession(ctx context.Context, input paymentrepository.StartCheckoutSessionInput) (*paymentrepository.StartCheckoutSessionOutput, error) {
	return stub.start(ctx, input)
}
func (stub *commandStub) SyncCheckoutSession(ctx context.Context, input paymentrepository.SyncCheckoutSessionInput) error {
	return stub.sync(ctx, input)
}
func (stub *commandStub) RecordCheckoutSessionEvent(ctx context.Context, input paymentrepository.RecordCheckoutSessionEventInput) error {
	return stub.record(ctx, input)
}

var testKey = []byte("payments-http-test-key")

func paymentRouter(commands Commands) http.Handler {
	handlers := &Handlers{Commands: commands, Key: testKey, FrontendURL: "https://app.example/payments/callback?keep=value"}
	router := mux.NewRouter()
	handlers.AddRoutes(router)
	return router
}

func accountToken(t *testing.T) string {
	t.Helper()
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &internal.Claims{
		Issuer: "beddybytes", Audience: "beddybytes", Expiry: time.Now().Add(time.Hour).Unix(), TokenUse: internal.TokenUseAccess, Scope: "account",
		Subject: internal.URN{Service: "iam", AccountID: "account-1", ResourceType: "user", ResourceID: "user-1"},
	}).SignedString(testKey)
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func TestStartUsesAuthenticatedAccountAndRedirects(t *testing.T) {
	for _, auth := range []string{"form", "header"} {
		t.Run(auth, func(t *testing.T) {
			var calls int
			router := paymentRouter(&commandStub{start: func(ctx context.Context, input paymentrepository.StartCheckoutSessionInput) (*paymentrepository.StartCheckoutSessionOutput, error) {
				calls++
				if input.AccountID != "account-1" {
					t.Errorf("checkout account=%q, want authenticated account", input.AccountID)
				}
				return &paymentrepository.StartCheckoutSessionOutput{CheckoutSessionID: "cs_test", CheckoutURL: "https://checkout.stripe.com/test"}, nil
			}})
			form := url.Values{"account_id": {"attacker-account"}, "return_url": {"https://attacker.example"}}
			if auth == "form" {
				form.Set("access_token", accountToken(t))
			}
			request := httptest.NewRequest(http.MethodPost, "/payments/start", strings.NewReader(form.Encode()))
			request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			if auth == "header" {
				request.Header.Set("Authorization", "Bearer "+accountToken(t))
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != http.StatusSeeOther || response.Header().Get("Location") != "https://checkout.stripe.com/test" || calls != 1 {
				t.Fatalf("response=%d location=%q calls=%d", response.Code, response.Header().Get("Location"), calls)
			}
			if response.Header().Get("Cache-Control") != "no-store" {
				t.Error("checkout response must not be cached")
			}
		})
	}
}

func TestStartRejectsUnauthenticatedRequests(t *testing.T) {
	for _, authorization := range []string{"", "Bearer invalid"} {
		request := httptest.NewRequest(http.MethodPost, "/payments/start", nil)
		request.Header.Set("Authorization", authorization)
		response := httptest.NewRecorder()
		paymentRouter(&commandStub{}).ServeHTTP(response, request)
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("status=%d, want 401", response.Code)
		}
	}
}

func TestStartErrorsDoNotRedirect(t *testing.T) {
	for _, test := range []struct {
		name string
		err  error
		want int
	}{
		{name: "ineligible", err: paymentrepository.ErrAccountIneligible, want: http.StatusForbidden},
		{name: "repository failure", err: errors.New("private persistence error"), want: http.StatusInternalServerError},
	} {
		t.Run(test.name, func(t *testing.T) {
			router := paymentRouter(&commandStub{start: func(context.Context, paymentrepository.StartCheckoutSessionInput) (*paymentrepository.StartCheckoutSessionOutput, error) {
				return nil, test.err
			}})
			request := httptest.NewRequest(http.MethodPost, "/payments/start", nil)
			request.Header.Set("Authorization", "Bearer "+accountToken(t))
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != test.want || response.Header().Get("Location") != "" {
				t.Fatalf("status=%d location=%q", response.Code, response.Header().Get("Location"))
			}
			if strings.Contains(response.Body.String(), "private persistence error") {
				t.Error("response exposed internal error")
			}
		})
	}
}

func TestSuccessSyncsSessionBeforeReturningToFrontend(t *testing.T) {
	var calls int
	router := paymentRouter(&commandStub{sync: func(_ context.Context, input paymentrepository.SyncCheckoutSessionInput) error {
		calls++
		if input.CheckoutSessionID != "cs_test" {
			t.Errorf("session ID=%q", input.CheckoutSessionID)
		}
		return nil
	}})
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/payments/stripe/success?session_id=cs_test&return_url=https://attacker.example", nil))
	if response.Code != http.StatusSeeOther || response.Header().Get("Location") != "https://app.example/payments/callback?keep=value" || calls != 1 {
		t.Fatalf("status=%d location=%q syncs=%d", response.Code, response.Header().Get("Location"), calls)
	}
}

func TestSuccessErrorsRedirectToCallback(t *testing.T) {
	for _, test := range []struct {
		name, path  string
		errorCode   string
		want, calls int
	}{
		{name: "missing session", path: "/payments/stripe/success", want: http.StatusSeeOther, errorCode: "invalid_request"},
		{name: "sync failure", path: "/payments/stripe/success?session_id=cs_test", want: http.StatusSeeOther, calls: 1, errorCode: "temporarily_unavailable"},
	} {
		t.Run(test.name, func(t *testing.T) {
			var calls int
			router := paymentRouter(&commandStub{sync: func(context.Context, paymentrepository.SyncCheckoutSessionInput) error {
				calls++
				return errors.New("sync failed")
			}})
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, test.path, nil))
			if response.Code != test.want || calls != test.calls || response.Header().Get("Location") != "https://app.example/payments/callback?error="+test.errorCode+"&keep=value" {
				t.Fatalf("status=%d calls=%d location=%q", response.Code, calls, response.Header().Get("Location"))
			}
		})
	}
}

func TestCancelOnlyRedirectsToConfiguredFrontend(t *testing.T) {
	response := httptest.NewRecorder()
	paymentRouter(&commandStub{}).ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/payments/stripe/cancel?return_url=https://attacker.example", nil))
	if response.Code != http.StatusSeeOther || response.Header().Get("Location") != "https://app.example/payments/callback?error=payment_cancelled&keep=value" {
		t.Fatalf("status=%d location=%q", response.Code, response.Header().Get("Location"))
	}
}

func TestWebhookForwardsRawBodyAndSignature(t *testing.T) {
	const payload = "{\n  \"id\": \"evt_test\"\n}\n"
	for _, commandError := range []error{nil, errors.New("persistence failed")} {
		var calls int
		request := httptest.NewRequest(http.MethodPost, "/payments/stripe/webhook", strings.NewReader(payload))
		type contextKey struct{}
		request = request.WithContext(context.WithValue(request.Context(), contextKey{}, "request marker"))
		request.Header.Set("Stripe-Signature", "raw-signature")
		router := paymentRouter(&commandStub{record: func(ctx context.Context, input paymentrepository.RecordCheckoutSessionEventInput) error {
			calls++
			if string(input.Payload) != payload || input.Signature != "raw-signature" {
				t.Errorf("webhook input=%+v", input)
			}
			if ctx.Value(contextKey{}) != "request marker" {
				t.Error("request context not forwarded")
			}
			return commandError
		}})
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		want := http.StatusOK
		if commandError != nil {
			want = http.StatusInternalServerError
		}
		if response.Code != want || calls != 1 {
			t.Fatalf("status=%d want=%d calls=%d", response.Code, want, calls)
		}
	}
}

func TestWebhookRejectsMissingSignatureAndOversizedBody(t *testing.T) {
	for _, test := range []struct {
		name, payload, signature string
		want                     int
	}{
		{name: "missing signature", payload: "{}", want: http.StatusBadRequest},
		{name: "oversized", payload: strings.Repeat("x", 1024*1024+1), signature: "test", want: http.StatusRequestEntityTooLarge},
	} {
		t.Run(test.name, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodPost, "/payments/stripe/webhook", strings.NewReader(test.payload))
			request.Header.Set("Stripe-Signature", test.signature)
			response := httptest.NewRecorder()
			paymentRouter(&commandStub{}).ServeHTTP(response, request)
			if response.Code != test.want {
				t.Fatalf("status=%d want=%d", response.Code, test.want)
			}
		})
	}
}

func TestPaymentRoutesRejectWrongMethods(t *testing.T) {
	for _, test := range []struct{ method, path string }{
		{http.MethodGet, "/payments/start"},
		{http.MethodPost, "/payments/stripe/success"},
		{http.MethodPost, "/payments/stripe/cancel"},
		{http.MethodGet, "/payments/stripe/webhook"},
	} {
		response := httptest.NewRecorder()
		paymentRouter(&commandStub{}).ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
		// Gorilla's nested start router can report 404 for a method mismatch.
		if response.Code != http.StatusMethodNotAllowed && response.Code != http.StatusNotFound {
			t.Errorf("%s %s: status=%d", test.method, test.path, response.Code)
		}
	}
}
