package checkoutsessions

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/stripe/stripe-go/v87"
)

func TestCreateSetsClientReferenceIDToAccountID(t *testing.T) {
	var requests int
	// Exercise the adapter and SDK encoding without sending network requests.
	backend := stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{
		MaxNetworkRetries: stripe.Int64(0),
		HTTPClient: &http.Client{Transport: stripeRoundTripper(func(request *http.Request) (*http.Response, error) {
			requests++
			if request.Method != http.MethodPost || request.URL.Path != "/v1/checkout/sessions" {
				t.Fatalf("unexpected Stripe request: %s %s", request.Method, request.URL.Path)
			}
			if err := request.ParseForm(); err != nil {
				t.Fatal(err)
			}
			if got := request.PostForm.Get("client_reference_id"); got != "checkout-owner" {
				t.Errorf("client_reference_id=%q, want checkout-owner", got)
			}
			return &http.Response{
				StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"application/json"}},
				Body:    io.NopCloser(strings.NewReader(`{"id":"cs_test_1","client_reference_id":"checkout-owner","url":"https://checkout.stripe.com/test-session"}`)),
				Request: request,
			}, nil
		})},
	})
	repository := NewStripeRepository(NewStripeRepositoryInput{
		Client:  stripe.NewClient("sk_test_fake", stripe.WithBackends(&stripe.Backends{API: backend})),
		PriceID: "price_perpetual", SuccessURL: "https://example.com/success", CancelURL: "https://example.com/cancel",
	})
	session, err := repository.Create(context.Background(), "checkout-owner")
	if err != nil {
		t.Fatal(err)
	}
	if requests != 1 {
		t.Fatalf("expected one Stripe request, got %d", requests)
	}
	if session == nil || session.ID != "cs_test_1" || session.ClientReferenceID != "checkout-owner" {
		t.Fatalf("unexpected checkout response: %+v", session)
	}
}

type stripeRoundTripper func(*http.Request) (*http.Response, error)

func (transport stripeRoundTripper) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}
