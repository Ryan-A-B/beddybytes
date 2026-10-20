package checkoutsessions

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stripe/stripe-go/v87"
)

// Check that the production adapter can be supplied wherever the command
// handler accepts the same Repository contract as the test fake.
var _ Repository = (*StripeRepository)(nil)

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

func TestRetrieveExpandsPaymentIntent(t *testing.T) {
	var requests int
	backend := stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{
		MaxNetworkRetries: stripe.Int64(0),
		HTTPClient: &http.Client{Transport: stripeRoundTripper(func(request *http.Request) (*http.Response, error) {
			requests++
			if request.Method != http.MethodGet || request.URL.Path != "/v1/checkout/sessions/cs_test_1" {
				t.Fatalf("unexpected Stripe request: %s %s", request.Method, request.URL.Path)
			}
			if expand := request.URL.Query().Get("expand[0]"); expand != "payment_intent" {
				t.Errorf("expansion=%q, want payment_intent", expand)
			}
			return &http.Response{
				StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"application/json"}},
				Body:    io.NopCloser(strings.NewReader(`{"id":"cs_test_1","payment_intent":{"id":"pi_test_1","status":"processing"}}`)),
				Request: request,
			}, nil
		})},
	})
	repository := NewStripeRepository(NewStripeRepositoryInput{
		Client: stripe.NewClient("sk_test_fake", stripe.WithBackends(&stripe.Backends{API: backend})),
	})
	session, err := repository.Retrieve(context.Background(), "cs_test_1")
	if err != nil {
		t.Fatal(err)
	}
	if requests != 1 || session == nil || session.PaymentIntent == nil || session.PaymentIntent.Status != stripe.PaymentIntentStatusProcessing {
		t.Fatalf("expected one retrieval with expanded processing intent; requests=%d session=%+v", requests, session)
	}
}

type stripeRoundTripper func(*http.Request) (*http.Response, error)

func (transport stripeRoundTripper) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

func TestParseNotificationVerifiesThinCheckoutEvents(t *testing.T) {
	const secret = "whsec_fixture"
	repository := NewStripeRepository(NewStripeRepositoryInput{Client: stripe.NewClient("sk_test_fixture"), WebhookSecret: secret})
	for _, eventType := range []string{
		"v1.checkout.session.completed", "v1.checkout.session.expired",
		"v1.checkout.session.async_payment_succeeded", "v1.checkout.session.async_payment_failed",
	} {
		t.Run(eventType, func(t *testing.T) {
			payload, err := json.Marshal(map[string]interface{}{
				"id": "evt_thin", "object": "v2.core.event", "type": eventType,
				"created": time.Now().UTC().Format(time.RFC3339), "livemode": false,
				"related_object": map[string]string{"id": "cs_fixture", "type": "checkout.session", "url": "/v1/checkout/sessions/cs_fixture"},
			})
			if err != nil {
				t.Fatal(err)
			}
			signed := stripe.GenerateTestSignedPayload(&stripe.UnsignedPayload{Payload: payload, Secret: secret})
			notification, err := repository.ParseNotification(payload, signed.Header)
			if err != nil || notification == nil || notification.CheckoutSessionID != "cs_fixture" {
				t.Fatalf("notification=%+v err=%v", notification, err)
			}
			// Tampering with the unchanged raw body invalidates the signature.
			tampered := append(append([]byte{}, payload...), byte(' '))
			if _, err := repository.ParseNotification(tampered, signed.Header); err == nil {
				t.Fatal("tampered body accepted")
			}
		})
	}
}

func TestParseNotificationRejectsMalformedOrSnapshotAndIgnoresUnrelated(t *testing.T) {
	const secret = "whsec_fixture"
	repository := NewStripeRepository(NewStripeRepositoryInput{Client: stripe.NewClient("sk_test_fixture"), WebhookSecret: secret})
	for _, test := range []struct {
		name, payload string
		wantErr       bool
	}{
		{"malformed JSON", `{"id":`, true},
		{"snapshot", `{"id":"evt_snapshot","object":"event","type":"checkout.session.completed","data":{"object":{"id":"cs_fixture"}}}`, true},
		{"missing related object", `{"id":"evt_missing","object":"v2.core.event","type":"v1.checkout.session.completed"}`, true},
		{"wrong related type", `{"id":"evt_wrong","object":"v2.core.event","type":"v1.checkout.session.completed","related_object":{"id":"cus_fixture","type":"customer"}}`, true},
		{"unrelated", `{"id":"evt_unrelated","object":"v2.core.event","type":"v1.customer.created","related_object":{"id":"cus_fixture","type":"customer"}}`, false},
		{"ping", `{"id":"evt_ping","object":"v2.core.event","type":"v2.core.event_destination.ping"}`, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			payload := []byte(test.payload)
			signed := stripe.GenerateTestSignedPayload(&stripe.UnsignedPayload{Payload: payload, Secret: secret})
			notification, err := repository.ParseNotification(payload, signed.Header)
			if (err != nil) != test.wantErr || notification != nil {
				t.Fatalf("notification=%+v err=%v wantErr=%v", notification, err, test.wantErr)
			}
		})
	}
	if _, err := repository.ParseNotification([]byte(`{}`), "invalid signature"); err == nil {
		t.Fatal("invalid signature accepted")
	}
}
