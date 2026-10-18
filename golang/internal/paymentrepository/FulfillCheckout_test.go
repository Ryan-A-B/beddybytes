package paymentrepository

import (
	"context"
	"errors"
	"testing"

	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
)

func TestFulfillCheckoutPaymentIntentStates(t *testing.T) {
	for _, test := range []struct {
		name          string
		sessionStatus stripe.CheckoutSessionStatus
		intent        *stripe.PaymentIntent
		provisional   bool
		paid          bool
		wantType      models.LicenseType
		wantEvent     eventlog.EventType
		wantErr       error
	}{
		{name: "expired session leaves trial unchanged", sessionStatus: stripe.CheckoutSessionStatusExpired, wantType: models.LicenseTypeTrial},
		{name: "expired session leaves provisional access from another checkout unchanged", sessionStatus: stripe.CheckoutSessionStatusExpired, provisional: true, wantType: models.LicenseTypeProvisional},
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
			sessionStatus := test.sessionStatus
			if sessionStatus == "" {
				sessionStatus = stripe.CheckoutSessionStatusComplete
			}
			err := handler.fulfillCheckout(ctx, &stripe.CheckoutSession{
				ID: "cs_test_1", ClientReferenceID: "account-1", Status: sessionStatus,
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

func TestFulfillCheckoutRejectsInvalidSessionWithoutEvents(t *testing.T) {
	for _, test := range []struct {
		name    string
		session *stripe.CheckoutSession
		wantErr error
	}{
		{name: "nil session"},
		{name: "unknown session status", session: &stripe.CheckoutSession{Status: "unknown"}, wantErr: ErrUnexpectedCheckoutSessionStatus},
		{name: "unknown payment status", session: &stripe.CheckoutSession{Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: "unknown"}, wantErr: ErrUnexpectedCheckoutSessionPaymentStatus},
	} {
		t.Run(test.name, func(t *testing.T) {
			log := &emptyPaymentEventLog{}
			handler := NewCommandHandler(NewCommandHandlerInput{EventLog: log})
			err := handler.fulfillCheckout(context.Background(), test.session)
			if err == nil || (test.wantErr != nil && !errors.Is(err, test.wantErr)) {
				t.Fatalf("validation error=%v, want non-nil matching %v", err, test.wantErr)
			}
			if got := log.appends.Load(); got != 0 {
				t.Errorf("invalid session attempted %d event appends", got)
			}
		})
	}
}
