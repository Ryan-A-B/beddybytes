package payments

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/accountrepository"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
	"github.com/Ryan-A-B/beddybytes/golang/internal/paymentrepository"
	"github.com/stripe/stripe-go/v87"
)

type webhookSyncTransport func(*http.Request) (*http.Response, error)

func (transport webhookSyncTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	return transport(request)
}

type webhookSyncLog struct {
	eventlog.EventLog
	grantEntered chan struct{}
	releaseGrant chan struct{}
	fail         bool
}

func (log *webhookSyncLog) Append(ctx context.Context, input eventlog.AppendInput) (*eventlog.Event, error) {
	if input.Type == events.TypePerpetualLicenseGranted {
		log.grantEntered <- struct{}{}
		select {
		case <-log.releaseGrant:
		case <-ctx.Done():
			return nil, ctx.Err()
		}
		if log.fail {
			return nil, errors.New("persistence unavailable")
		}
	}
	return log.EventLog.Append(ctx, input)
}

func TestSignedThinWebhookRetrievesAndAcknowledgesOnlyAfterDurableFulfillment(t *testing.T) {
	for _, failPersistence := range []bool{false, true} {
		name := "success"
		if failPersistence {
			name = "persistence failure"
		}
		t.Run(name, func(t *testing.T) {
			lifetime, cancel := context.WithCancel(context.Background())
			defer cancel()
			rawLog := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: t.TempDir()})
			if _, err := rawLog.Append(lifetime, eventlog.AppendInput{Type: events.TypeAccountCreatedV2, Data: []byte(`{"account_id":"account-1"}`)}); err != nil {
				t.Fatal(err)
			}
			log := &webhookSyncLog{EventLog: rawLog, grantEntered: make(chan struct{}, 1), releaseGrant: make(chan struct{}), fail: failPersistence}
			var retrieves atomic.Int32
			backend := stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{MaxNetworkRetries: stripe.Int64(0), HTTPClient: &http.Client{Transport: webhookSyncTransport(func(request *http.Request) (*http.Response, error) {
				retrieves.Add(1)
				if request.Method != http.MethodGet || request.URL.Path != "/v1/checkout/sessions/cs_fixture" || request.URL.Query().Get("expand[0]") != "payment_intent" {
					t.Errorf("unexpected retrieval: %s %s", request.Method, request.URL)
				}
				return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"application/json"}}, Request: request, Body: io.NopCloser(strings.NewReader(`{"id":"cs_fixture","client_reference_id":"account-1","status":"complete","payment_status":"paid","payment_intent":{"id":"pi_fixture","status":"succeeded"}}`))}, nil
			})}})
			commands := paymentrepository.NewStripeCommandHandler(paymentrepository.NewStripeCommandHandlerInput{Context: lifetime, EventLog: log, Client: stripe.NewClient("sk_test_fixture", stripe.WithBackends(&stripe.Backends{API: backend})), WebhookSecret: "whsec_fixture"})
			router := paymentRouter(commands)
			payload := []byte(`{"id":"evt_fixture","object":"v2.core.event","type":"v1.checkout.session.completed","related_object":{"id":"cs_fixture","type":"checkout.session","url":"/v1/checkout/sessions/cs_fixture"}}`)
			signed := stripe.GenerateTestSignedPayload(&stripe.UnsignedPayload{Payload: payload, Secret: "whsec_fixture"})
			send := func(signature string) *httptest.ResponseRecorder {
				request := httptest.NewRequest(http.MethodPost, "/payments/stripe/webhook", bytes.NewReader(payload))
				request.Header.Set("Stripe-Signature", signature)
				response := httptest.NewRecorder()
				router.ServeHTTP(response, request)
				return response
			}
			invalid := send("invalid")
			if invalid.Code < 400 || retrieves.Load() != 0 {
				t.Fatalf("invalid signature status=%d retrieves=%d", invalid.Code, retrieves.Load())
			}
			finished := make(chan *httptest.ResponseRecorder, 1)
			go func() { finished <- send(signed.Header) }()
			select {
			case <-log.grantEntered:
			case <-time.After(5 * time.Second):
				t.Fatal("webhook did not reach persistence")
			}
			select {
			case response := <-finished:
				t.Fatalf("webhook returned %d before persistence", response.Code)
			default:
			}
			close(log.releaseGrant)
			select {
			case response := <-finished:
				want := http.StatusOK
				if failPersistence {
					want = http.StatusInternalServerError
				}
				if response.Code != want {
					t.Fatalf("status=%d want %d body=%s", response.Code, want, response.Body)
				}
			case <-time.After(5 * time.Second):
				t.Fatal("webhook did not finish")
			}
			query := accountrepository.NewQueryHandler(accountrepository.NewQueryHandlerInput{EventLog: rawLog})
			license, err := query.GetLicenseForAccount(lifetime, "account-1")
			if err != nil {
				t.Fatal(err)
			}
			wantLicense := models.LicenseTypePerpetual
			if failPersistence {
				wantLicense = models.LicenseTypeTrial
			}
			if license.Type != wantLicense {
				t.Fatalf("license=%s want %s", license.Type, wantLicense)
			}
			if retrieves.Load() != 1 {
				t.Fatalf("retrieves=%d", retrieves.Load())
			}
		})
	}
}
