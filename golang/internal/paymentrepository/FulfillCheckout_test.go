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

func TestFulfillCheckoutPaymentIntentStates(t *testing.T) {
	for _, test := range []struct {
		name        string
		intent      *stripe.PaymentIntent
		provisional bool
		paid        bool
		wantType    models.LicenseType
		wantEvent   eventlog.EventType
		wantErr     error
	}{
		{name: "processing grants provisional", intent: &stripe.PaymentIntent{Status: stripe.PaymentIntentStatusProcessing}, wantType: models.LicenseTypeProvisional, wantEvent: events.TypeProvisionalLicenseGranted},
		{name: "processing retains provisional", intent: &stripe.PaymentIntent{Status: stripe.PaymentIntentStatusProcessing}, provisional: true, wantType: models.LicenseTypeProvisional},
		{name: "requires payment method revokes", intent: &stripe.PaymentIntent{Status: stripe.PaymentIntentStatusRequiresPaymentMethod}, provisional: true, wantType: models.LicenseTypeTrial, wantEvent: events.TypeProvisionalLicenseRevoked},
		{name: "requires confirmation revokes", intent: &stripe.PaymentIntent{Status: stripe.PaymentIntentStatusRequiresConfirmation}, provisional: true, wantType: models.LicenseTypeTrial, wantEvent: events.TypeProvisionalLicenseRevoked},
		{name: "requires action revokes", intent: &stripe.PaymentIntent{Status: stripe.PaymentIntentStatusRequiresAction}, provisional: true, wantType: models.LicenseTypeTrial, wantEvent: events.TypeProvisionalLicenseRevoked},
		{name: "requires capture revokes", intent: &stripe.PaymentIntent{Status: stripe.PaymentIntentStatusRequiresCapture}, provisional: true, wantType: models.LicenseTypeTrial, wantEvent: events.TypeProvisionalLicenseRevoked},
		{name: "canceled revokes", intent: &stripe.PaymentIntent{Status: stripe.PaymentIntentStatusCanceled}, provisional: true, wantType: models.LicenseTypeTrial, wantEvent: events.TypeProvisionalLicenseRevoked},
		{name: "nonprocessing does not change original trial", intent: &stripe.PaymentIntent{Status: stripe.PaymentIntentStatusRequiresAction}, wantType: models.LicenseTypeTrial},
		{name: "paid grants perpetual", paid: true, provisional: true, wantEvent: events.TypePerpetualLicenseGranted},
		{name: "missing intent preserves access and returns error", provisional: true, wantType: models.LicenseTypeProvisional, wantErr: ErrPaymentIntentNotExpanded},
		{name: "unexpanded intent preserves access and returns error", intent: &stripe.PaymentIntent{ID: "pi_id_only"}, provisional: true, wantType: models.LicenseTypeProvisional, wantErr: ErrPaymentIntentNotExpanded},
	} {
		t.Run(test.name, func(t *testing.T) {
			ctx := context.Background()
			log := newRestartTestLog(t)
			handler := NewCommandHandler(NewCommandHandlerInput{EventLog: log})
			if err := handler.catchup(ctx); err != nil {
				t.Fatal(err)
			}
			trialStart := handler.eligibleAccounts["account-1"].StartUnixSeconds
			if test.provisional {
				if _, err := log.Append(ctx, eventlog.AppendInput{Type: events.TypeProvisionalLicenseGranted, AccountID: "account-1"}); err != nil {
					t.Fatal(err)
				}
				if err := handler.catchup(ctx); err != nil {
					t.Fatal(err)
				}
			}
			cursor := handler.cursor
			status := stripe.CheckoutSessionPaymentStatusUnpaid
			if test.paid {
				status = stripe.CheckoutSessionPaymentStatusPaid
			}
			err := handler.fulfillCheckout(ctx, &stripe.CheckoutSession{
				ID: "cs_test_1", ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete,
				PaymentStatus: status, PaymentIntent: test.intent,
			})
			if !errors.Is(err, test.wantErr) {
				t.Fatalf("fulfillment error=%v, want %v", err, test.wantErr)
			}
			if err := handler.catchup(ctx); err != nil {
				t.Fatal(err)
			}
			license := handler.eligibleAccounts["account-1"]
			if test.paid {
				if license != nil {
					t.Fatalf("paid account still eligible: %+v", license)
				}
			} else {
				if license == nil || license.Type != test.wantType {
					t.Fatalf("license=%+v, want %s", license, test.wantType)
				}
				if test.wantType == models.LicenseTypeTrial {
					if license.StartUnixSeconds != trialStart || license.ProvisionalLicense != nil {
						t.Errorf("original trial was changed: %+v", license)
					}
				} else if license.ProvisionalLicense == nil || license.ProvisionalLicense.TrialStartUnixSeconds != trialStart {
					t.Errorf("provisional license lost original trial date: %+v", license)
				}
			}
			iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{FromCursor: cursor})
			var emitted int
			for iterator.Next(ctx) {
				emitted++
				if event := iterator.Event(); event.Type != test.wantEvent || event.AccountID != "account-1" {
					t.Errorf("unexpected event: type=%s account=%s", event.Type, event.AccountID)
				}
			}
			if err := iterator.Err(); err != nil {
				t.Fatal(err)
			}
			wantEmitted := 0
			if test.wantEvent != "" {
				wantEmitted = 1
			}
			if emitted != wantEmitted {
				t.Errorf("emitted %d events, want %d", emitted, wantEmitted)
			}
		})
	}
}

func TestWebhookReconcilesCurrentStateInsteadOfFailureSnapshot(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	var retrieves int
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: log,
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{
			constructEvent: func([]byte, string) (*stripe.Event, error) {
				return &stripe.Event{
					Type: stripe.EventTypeCheckoutSessionAsyncPaymentFailed,
					Data: &stripe.EventData{Raw: json.RawMessage(`{"id":"cs_test_1","client_reference_id":"account-1","status":"complete","payment_status":"unpaid","payment_intent":{"id":"pi_test_1","status":"requires_payment_method"}}`)},
				}, nil
			},
			retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
				retrieves++
				if id != "cs_test_1" {
					t.Errorf("retrieved %q, want webhook session cs_test_1", id)
				}
				return &stripe.CheckoutSession{
					ID: id, ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete,
					PaymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid,
					PaymentIntent: &stripe.PaymentIntent{ID: "pi_test_1", Status: stripe.PaymentIntentStatusProcessing},
				}, nil
			},
		},
	})
	if err := handler.RecordCheckoutSessionEvent(ctx, RecordCheckoutSessionEventInput{Payload: []byte("verified by fake repository")}); err != nil {
		t.Fatal(err)
	}
	if err := handler.catchup(ctx); err != nil {
		t.Fatal(err)
	}
	license := handler.eligibleAccounts["account-1"]
	if retrieves != 1 || license == nil || license.Type != models.LicenseTypeProvisional {
		t.Fatalf("expected provisional access from current processing state, not old failure; retrieves=%d license=%+v", retrieves, license)
	}
}
