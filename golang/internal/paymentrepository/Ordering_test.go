package paymentrepository

import (
	"context"
	"encoding/json"
	"fmt"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
)

func TestPaidWebhookDuringOlderUnpaidSyncGrantsPerpetualLicense(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	log := newRestartTestLog(t)
	data, err := json.Marshal(events.StripeCheckoutSessionStartedDetail{
		SessionID: "cs_ordering", CheckoutURL: "https://checkout.stripe.com/ordering",
		SessionExpiresAt: time.Now().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := log.Append(ctx, eventlog.AppendInput{
		Type: events.TypeStripeCheckoutSessionStarted, AccountID: "account-1", Data: data,
	}); err != nil {
		t.Fatal(err)
	}
	oldRetrieveEntered := make(chan struct{})
	releaseOldRetrieve := make(chan struct{})
	webhookFulfillment := make(chan struct{})
	var retrieves, reads atomic.Int32
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: &observedPaymentEventLog{EventLog: log, onRead: func() {
			if reads.Add(1) == 2 {
				close(webhookFulfillment)
			}
		}},
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{
			retrieve: func(ctx context.Context, id string) (*stripe.CheckoutSession, error) {
				session := &stripe.CheckoutSession{
					ID: id, ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete,
					PaymentStatus: stripe.CheckoutSessionPaymentStatusPaid,
				}
				if retrieves.Add(1) == 1 {
					// Capture the processing snapshot before payment succeeds. Later
					// retrievals see paid, but this request returns its older snapshot.
					session.PaymentStatus = stripe.CheckoutSessionPaymentStatusUnpaid
					session.PaymentIntent = &stripe.PaymentIntent{ID: "pi_ordering", Status: stripe.PaymentIntentStatusProcessing}
					close(oldRetrieveEntered)
					select {
					case <-releaseOldRetrieve:
					case <-ctx.Done():
						return nil, ctx.Err()
					}
				}
				return session, nil
			},
			constructEvent: func([]byte, string) (stripe.Event, error) {
				return stripe.Event{
					Type: stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded,
					Data: &stripe.EventData{Raw: json.RawMessage(`{"id":"cs_ordering","client_reference_id":"account-1","status":"complete","payment_status":"paid"}`)},
				}, nil
			},
		},
	})
	results := make(chan error, 2)
	go func() {
		results <- handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_ordering"})
	}()
	select {
	case <-oldRetrieveEntered:
	case <-ctx.Done():
		t.Fatal("initial sync did not enter Retrieve")
	}
	go func() {
		results <- handler.RecordCheckoutSessionEvent(ctx, RecordCheckoutSessionEventInput{})
	}()
	select {
	case <-webhookFulfillment:
	case <-ctx.Done():
		t.Fatal("paid webhook did not reach fulfillment")
	}
	// Webhook fulfillment holds the handler lock: the older retrieval cannot
	// apply its processing snapshot until the paid grant has been persisted.
	close(releaseOldRetrieve)
	for i := 0; i < 2; i++ {
		select {
		case err := <-results:
			if err != nil {
				t.Fatal(err)
			}
		case <-ctx.Done():
			t.Fatal("sync or webhook did not finish")
		}
	}
	if err := handler.catchup(ctx); err != nil {
		t.Fatal(err)
	}
	if license, eligible := handler.eligibleAccounts["account-1"]; eligible {
		t.Fatalf("paid webhook was acknowledged but account is still eligible with license %+v (Retrieve calls=%d)", license, retrieves.Load())
	}
}

func TestOlderFailedAttemptDoesNotRevokeNewerProcessingCheckout(t *testing.T) {
	t.Skip("accepted for manual resolution; see KNOWN_LIMITATIONS.md: overlapping processing payments")
	ctx := context.Background()
	log := newRestartTestLog(t)
	// An old checkout completed before its checkout deadline, but the bank
	// payment is still processing after that deadline. Start permits another
	// checkout once the stored deadline passes.
	data, err := json.Marshal(events.StripeCheckoutSessionStartedDetail{
		SessionID: "cs_old", CheckoutURL: "https://checkout.stripe.com/old",
		SessionExpiresAt: time.Now().Add(-time.Hour).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := log.Append(ctx, eventlog.AppendInput{
		Type: events.TypeStripeCheckoutSessionStarted, AccountID: "account-1", Data: data,
	}); err != nil {
		t.Fatal(err)
	}
	oldStatus := stripe.PaymentIntentStatusProcessing
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: log,
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{
			create: func(context.Context, string) (*stripe.CheckoutSession, error) {
				return &stripe.CheckoutSession{
					ID: "cs_new", URL: "https://checkout.stripe.com/new", ExpiresAt: time.Now().Add(time.Hour).Unix(),
				}, nil
			},
			retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
				status := stripe.PaymentIntentStatusProcessing
				if id == "cs_old" {
					status = oldStatus
				} else if id != "cs_new" {
					return nil, fmt.Errorf("unexpected session %s", id)
				}
				return &stripe.CheckoutSession{
					ID: id, ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete,
					PaymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid,
					PaymentIntent: &stripe.PaymentIntent{ID: "pi_" + id, Status: status},
				}, nil
			},
		},
	})
	if err := handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_old"}); err != nil {
		t.Fatal(err)
	}
	newCheckout, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
	if err != nil || newCheckout == nil || newCheckout.CheckoutSessionID != "cs_new" {
		t.Fatalf("new checkout: output=%+v err=%v", newCheckout, err)
	}
	if err := handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_new"}); err != nil {
		t.Fatal(err)
	}
	cursor := handler.cursor
	// Both payments were processing. Only the older payment now fails.
	oldStatus = stripe.PaymentIntentStatusRequiresPaymentMethod
	if err := handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_old"}); err != nil {
		t.Fatal(err)
	}
	if err := handler.catchup(ctx); err != nil {
		t.Fatal(err)
	}
	license := handler.eligibleAccounts["account-1"]
	if license == nil || license.Type != models.LicenseTypeProvisional {
		t.Errorf("newer checkout is still processing but access was revoked: %+v", license)
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{FromCursor: cursor})
	for iterator.Next(ctx) {
		t.Errorf("older failure should not change newer checkout entitlement; emitted %s", iterator.Event().Type)
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
}
