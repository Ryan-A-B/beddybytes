package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
)

func TestPaymentRoutesRegisterConfiguredCallbacks(t *testing.T) {
	t.Setenv("STRIPE_SECRET_KEY", "sk_test_placeholder")
	t.Setenv("STRIPE_WEBHOOK_SECRET", "whsec_placeholder")
	t.Setenv("STRIPE_PERPETUAL_PRICE_ID", "price_placeholder")
	t.Setenv("API_ORIGIN", "https://api.example")
	t.Setenv("FRONTEND_PAYMENT_CALLBACK_URL", "https://app.example/payments/callback")
	router := mux.NewRouter()
	addPaymentRoutes(context.Background(), router, nil, []byte("test-key"))
	for _, test := range []struct {
		method, path string
		want         int
		location     string
	}{
		{method: http.MethodPost, path: "/payments/start", want: http.StatusUnauthorized},
		{method: http.MethodGet, path: "/payments/stripe/cancel", want: http.StatusSeeOther, location: "https://app.example/payments/callback?error=payment_cancelled"},
		{method: http.MethodGet, path: "/payments/stripe/success", want: http.StatusSeeOther, location: "https://app.example/payments/callback?error=invalid_request"},
		{method: http.MethodPost, path: "/payments/stripe/webhook", want: http.StatusBadRequest},
	} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))
		if response.Code != test.want || response.Header().Get("Location") != test.location {
			t.Errorf("%s %s: status=%d location=%q", test.method, test.path, response.Code, response.Header().Get("Location"))
		}
	}
}
