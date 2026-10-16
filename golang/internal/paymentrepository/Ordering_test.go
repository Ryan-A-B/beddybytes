package paymentrepository

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
)

func TestOlderFailedAttemptDoesNotRevokeNewerProcessingCheckout(t *testing.T) {
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
