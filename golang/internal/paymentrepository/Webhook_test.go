package paymentrepository

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
)

func TestRepeatedWebhookDoesNotDuplicateLicenseChanges(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	var event stripe.Event
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog:                  log,
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{constructEvent: func([]byte, string) (stripe.Event, error) { return event, nil }},
	})
	for _, step := range []struct {
		eventType     stripe.EventType
		paymentStatus stripe.CheckoutSessionPaymentStatus
		intentStatus  stripe.PaymentIntentStatus
		wantLicense   models.LicenseType
	}{
		{stripe.EventTypeCheckoutSessionCompleted, stripe.CheckoutSessionPaymentStatusUnpaid, stripe.PaymentIntentStatusProcessing, models.LicenseTypeProvisional},
		{stripe.EventTypeCheckoutSessionAsyncPaymentFailed, stripe.CheckoutSessionPaymentStatusUnpaid, stripe.PaymentIntentStatusRequiresPaymentMethod, models.LicenseTypeTrial},
		{stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded, stripe.CheckoutSessionPaymentStatusPaid, stripe.PaymentIntentStatusSucceeded, models.LicenseTypePerpetual},
	} {
		data, err := json.Marshal(&stripe.CheckoutSession{ID: "cs_repeat", ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: step.paymentStatus, PaymentIntent: &stripe.PaymentIntent{ID: "pi_repeat", Status: step.intentStatus}})
		if err != nil {
			t.Fatal(err)
		}
		event = stripe.Event{Type: step.eventType, Data: &stripe.EventData{Raw: data}}
		for delivery := 0; delivery < 3; delivery++ {
			if err := handler.RecordCheckoutSessionEvent(ctx, RecordCheckoutSessionEventInput{}); err != nil {
				t.Fatal(err)
			}
		}
		if err := handler.catchup(ctx); err != nil {
			t.Fatal(err)
		}
		license := handler.eligibleAccounts["account-1"]
		if step.wantLicense == models.LicenseTypePerpetual {
			if license != nil {
				t.Fatalf("paid account remains eligible: %+v", license)
			}
		} else if license == nil || license.Type != step.wantLicense {
			t.Fatalf("license=%+v, want %s", license, step.wantLicense)
		}
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
	counts := map[eventlog.EventType]int{}
	for iterator.Next(ctx) {
		counts[iterator.Event().Type]++
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
	for _, eventType := range []eventlog.EventType{events.TypeProvisionalLicenseGranted, events.TypeProvisionalLicenseRevoked, events.TypePerpetualLicenseGranted} {
		if counts[eventType] != 1 {
			t.Errorf("%s events=%d, want 1", eventType, counts[eventType])
		}
	}
}

func TestOlderWebhooksAfterPaidSyncKeepPerpetualLicense(t *testing.T) {
	testOlderWebhooksAfterPaidSync(t, "cs_paid")
}

func TestOlderAttemptFailureOrExpiryKeepsNewerPaidLicense(t *testing.T) {
	testOlderWebhooksAfterPaidSync(t, "cs_old")
}

func testOlderWebhooksAfterPaidSync(t *testing.T, webhookSessionID string) {
	t.Helper()
	for _, test := range []struct {
		name          string
		sessionStatus stripe.CheckoutSessionStatus
		intentStatus  stripe.PaymentIntentStatus
		eventType     stripe.EventType
	}{
		{"processing", stripe.CheckoutSessionStatusComplete, stripe.PaymentIntentStatusProcessing, stripe.EventTypeCheckoutSessionCompleted},
		{"failed", stripe.CheckoutSessionStatusComplete, stripe.PaymentIntentStatusRequiresPaymentMethod, stripe.EventTypeCheckoutSessionAsyncPaymentFailed},
		{"expired", stripe.CheckoutSessionStatusExpired, "", stripe.EventTypeCheckoutSessionExpired},
	} {
		t.Run(test.name, func(t *testing.T) {
			ctx := context.Background()
			log := newRestartTestLog(t)
			data, err := json.Marshal(&stripe.CheckoutSession{ID: webhookSessionID, ClientReferenceID: "account-1", Status: test.sessionStatus, PaymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid, PaymentIntent: &stripe.PaymentIntent{ID: "pi_paid", Status: test.intentStatus}})
			if err != nil {
				t.Fatal(err)
			}
			handler := NewCommandHandler(NewCommandHandlerInput{
				EventLog: log,
				CheckoutSessionRepository: &checkoutSessionRepositoryStub{
					retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
						return &stripe.CheckoutSession{ID: id, ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: stripe.CheckoutSessionPaymentStatusPaid}, nil
					},
					constructEvent: func([]byte, string) (stripe.Event, error) {
						return stripe.Event{Type: test.eventType, Data: &stripe.EventData{Raw: data}}, nil
					},
				},
			})
			if err := handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_paid"}); err != nil {
				t.Fatal(err)
			}
			if err := handler.RecordCheckoutSessionEvent(ctx, RecordCheckoutSessionEventInput{}); err != nil {
				t.Fatal(err)
			}
			if err := handler.catchup(ctx); err != nil {
				t.Fatal(err)
			}
			if license := handler.eligibleAccounts["account-1"]; license != nil {
				t.Fatalf("older webhook changed perpetual license: %+v", license)
			}
			iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
			var grants int
			for iterator.Next(ctx) {
				switch event := iterator.Event(); event.Type {
				case events.TypePerpetualLicenseGranted:
					grants++
				case events.TypeProvisionalLicenseGranted, events.TypeProvisionalLicenseRevoked:
					t.Errorf("older webhook emitted %s", event.Type)
				}
			}
			if err := iterator.Err(); err != nil {
				t.Fatal(err)
			}
			if grants != 1 {
				t.Fatalf("perpetual grants=%d, want 1", grants)
			}
		})
	}
}

func TestInvalidWebhookDoesNotChangeState(t *testing.T) {
	signatureError := errors.New("invalid signature")
	for _, test := range []struct {
		name           string
		constructError error
		data           json.RawMessage
	}{
		{name: "invalid signature", constructError: signatureError},
		{name: "malformed JSON", data: json.RawMessage(`{"id":`)},
	} {
		t.Run(test.name, func(t *testing.T) {
			ctx := context.Background()
			log := newRestartTestLog(t)
			var retrieves int
			handler := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: &checkoutSessionRepositoryStub{
				constructEvent: func(payload []byte, signature string) (stripe.Event, error) {
					if string(payload) != "raw payload" || signature != "test-signature" {
						t.Errorf("verification received payload=%q signature=%q", payload, signature)
					}
					return stripe.Event{Type: stripe.EventTypeCheckoutSessionCompleted, Data: &stripe.EventData{Raw: test.data}}, test.constructError
				},
				retrieve: func(context.Context, string) (*stripe.CheckoutSession, error) {
					retrieves++
					return nil, errors.New("unexpected Retrieve")
				},
			}})
			if err := handler.catchup(ctx); err != nil {
				t.Fatal(err)
			}
			cursor := handler.cursor
			before := *handler.eligibleAccounts["account-1"]
			err := handler.RecordCheckoutSessionEvent(ctx, RecordCheckoutSessionEventInput{Payload: []byte("raw payload"), Signature: "test-signature"})
			if err == nil {
				t.Fatal("invalid webhook returned nil error")
			}
			if test.constructError != nil && !errors.Is(err, test.constructError) {
				t.Errorf("error=%v, want signature error", err)
			}
			if err := handler.catchup(ctx); err != nil {
				t.Fatal(err)
			}
			if after := handler.eligibleAccounts["account-1"]; after == nil || *after != before {
				t.Errorf("invalid webhook changed license: %+v", after)
			}
			if handler.cursor != cursor || retrieves != 0 {
				t.Errorf("invalid webhook caused side effects: cursor=%d, want %d; retrieves=%d", handler.cursor, cursor, retrieves)
			}
		})
	}
}

func TestUnrelatedWebhookIsIgnored(t *testing.T) {
	ctx := context.Background()
	log := &emptyPaymentEventLog{}
	handler := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: &checkoutSessionRepositoryStub{
		constructEvent: func([]byte, string) (stripe.Event, error) {
			// An unrelated event need not even carry Checkout Session-shaped data.
			return stripe.Event{Type: stripe.EventTypePaymentIntentSucceeded, Data: &stripe.EventData{Raw: json.RawMessage(`{"id":"pi_unrelated"}`)}}, nil
		},
	}})
	if err := handler.RecordCheckoutSessionEvent(ctx, RecordCheckoutSessionEventInput{}); err != nil {
		t.Fatal(err)
	}
	if log.appends.Load() != 0 {
		t.Fatal("unrelated webhook attempted an event append")
	}
	if len(handler.eligibleAccounts) != 0 || len(handler.syncInProgress) != 0 {
		t.Fatal("unrelated webhook changed handler state")
	}
}
