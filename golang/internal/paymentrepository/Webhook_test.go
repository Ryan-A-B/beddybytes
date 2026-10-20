package paymentrepository

import (
	"context"
	"errors"
	"testing"

	"github.com/Ryan-A-B/beddybytes/golang/internal/accountrepository"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
	"github.com/Ryan-A-B/beddybytes/golang/internal/paymentrepository/internal/checkoutsessions"
	"github.com/stripe/stripe-go/v87"
)

func TestWebhookSyncsCurrentStateAndIgnoresStaleNotificationState(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	recordCheckoutStarted(t, log, "account-1", "cs_notification")
	var retrieves int
	intentStatus := stripe.PaymentIntentStatusProcessing
	paymentStatus := stripe.CheckoutSessionPaymentStatusUnpaid
	handler := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: &checkoutSessionRepositoryStub{
		parseNotification: func(payload []byte, signature string) (*checkoutsessions.Notification, error) {
			if string(payload) != "unchanged notification" || signature != "signature" {
				t.Error("notification body or signature changed")
			}
			return &checkoutsessions.Notification{CheckoutSessionID: "cs_notification"}, nil
		},
		retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
			retrieves++
			if id != "cs_notification" {
				t.Errorf("retrieved %q", id)
			}
			return &stripe.CheckoutSession{ID: id, ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: paymentStatus, PaymentIntent: &stripe.PaymentIntent{Status: intentStatus}}, nil
		},
	}})
	for _, step := range []struct {
		intent  stripe.PaymentIntentStatus
		payment stripe.CheckoutSessionPaymentStatus
		want    models.LicenseType
	}{
		{stripe.PaymentIntentStatusProcessing, stripe.CheckoutSessionPaymentStatusUnpaid, models.LicenseTypeProvisional},
		{stripe.PaymentIntentStatusRequiresPaymentMethod, stripe.CheckoutSessionPaymentStatusUnpaid, models.LicenseTypeTrial},
		// Redeliver the original completion notification after failure. Only retrieved state counts.
		{stripe.PaymentIntentStatusRequiresPaymentMethod, stripe.CheckoutSessionPaymentStatusUnpaid, models.LicenseTypeTrial},
		{stripe.PaymentIntentStatusSucceeded, stripe.CheckoutSessionPaymentStatusPaid, models.LicenseTypePerpetual},
		{stripe.PaymentIntentStatusSucceeded, stripe.CheckoutSessionPaymentStatusPaid, models.LicenseTypePerpetual},
		// Even an older unpaid result cannot undo an already-persisted paid grant.
		{stripe.PaymentIntentStatusProcessing, stripe.CheckoutSessionPaymentStatusUnpaid, models.LicenseTypePerpetual},
		{stripe.PaymentIntentStatusRequiresPaymentMethod, stripe.CheckoutSessionPaymentStatusUnpaid, models.LicenseTypePerpetual},
	} {
		intentStatus, paymentStatus = step.intent, step.payment
		if err := handler.RecordCheckoutSessionEvent(ctx, RecordCheckoutSessionEventInput{Payload: []byte("unchanged notification"), Signature: "signature"}); err != nil {
			t.Fatal(err)
		}
		query := accountrepository.NewQueryHandler(accountrepository.NewQueryHandlerInput{EventLog: log})
		license, err := query.GetLicenseForAccount(ctx, "account-1")
		if err != nil {
			t.Fatal(err)
		}
		if license.Type != step.want {
			t.Fatalf("license=%s want %s", license.Type, step.want)
		}
	}
	if retrieves != 7 {
		t.Fatalf("retrieves=%d", retrieves)
	}
	counts := map[eventlog.EventType]int{}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
	for iterator.Next(ctx) {
		counts[iterator.Event().Type]++
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
	for _, eventType := range []eventlog.EventType{events.TypeProvisionalLicenseGranted, events.TypeProvisionalLicenseRevoked, events.TypePerpetualLicenseGranted} {
		if counts[eventType] != 1 {
			t.Errorf("%s events=%d", eventType, counts[eventType])
		}
	}
}

func TestWebhookParsingAndRetrievalFailuresRemainRetryable(t *testing.T) {
	for _, test := range []struct {
		name                  string
		parseErr, retrieveErr error
		ignored               bool
	}{
		{name: "invalid signature", parseErr: errors.New("invalid signature")},
		{name: "malformed notification", parseErr: errors.New("malformed JSON")},
		{name: "unrelated notification", ignored: true},
		{name: "Stripe unavailable", retrieveErr: errors.New("Stripe unavailable")},
	} {
		t.Run(test.name, func(t *testing.T) {
			log := newRestartTestLog(t)
			recordCheckoutStarted(t, log, "account-1", "cs_retry")
			retrieves := 0
			handler := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: &checkoutSessionRepositoryStub{
				parseNotification: func([]byte, string) (*checkoutsessions.Notification, error) {
					if test.parseErr != nil || test.ignored {
						return nil, test.parseErr
					}
					return &checkoutsessions.Notification{CheckoutSessionID: "cs_retry"}, nil
				},
				retrieve: func(context.Context, string) (*stripe.CheckoutSession, error) {
					retrieves++
					return nil, test.retrieveErr
				},
			}})
			err := handler.RecordCheckoutSessionEvent(context.Background(), RecordCheckoutSessionEventInput{})
			wantErr := test.parseErr
			if wantErr == nil {
				wantErr = test.retrieveErr
			}
			if !errors.Is(err, wantErr) {
				t.Fatalf("err=%v want %v", err, wantErr)
			}
			wantRetrieves := 0
			if test.retrieveErr != nil {
				wantRetrieves = 1
			}
			if retrieves != wantRetrieves {
				t.Fatalf("retrieves=%d want %d", retrieves, wantRetrieves)
			}
			iterator := log.GetEventIterator(context.Background(), eventlog.GetEventIteratorInput{})
			for iterator.Next(context.Background()) {
				if iterator.Event().Type != events.TypeAccountCreatedV2 && iterator.Event().Type != events.TypeStripeCheckoutSessionStarted {
					t.Errorf("unexpected event %s", iterator.Event().Type)
				}
			}
		})
	}
}
