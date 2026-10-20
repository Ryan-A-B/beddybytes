package paymentrepository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"reflect"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/stripe/stripe-go/v87"
)

func TestCompletedCheckoutSessionInfoLifecycle(t *testing.T) {
	for _, restart := range []bool{false, true} {
		for _, outcome := range []string{"paid", "processing", "revoked", "failed without provisional"} {
			t.Run(fmt.Sprintf("%s/restart=%v", outcome, restart), func(t *testing.T) {
				ctx := context.Background()
				log := newRestartTestLog(t)
				creates := 0
				intentStatus := stripe.PaymentIntentStatusProcessing
				paymentStatus := stripe.CheckoutSessionPaymentStatusUnpaid
				if outcome == "paid" {
					paymentStatus = stripe.CheckoutSessionPaymentStatusPaid
				}
				if outcome == "failed without provisional" {
					intentStatus = stripe.PaymentIntentStatusRequiresPaymentMethod
				}
				repository := &checkoutSessionRepositoryStub{
					create: func(context.Context, string) (*stripe.CheckoutSession, error) {
						creates++
						return &stripe.CheckoutSession{ID: fmt.Sprintf("cs_%d", creates), URL: fmt.Sprintf("https://checkout.stripe.com/%d", creates), ExpiresAt: time.Now().Add(time.Hour).Unix()}, nil
					},
					retrieve: func(_ context.Context, sessionID string) (*stripe.CheckoutSession, error) {
						return &stripe.CheckoutSession{ID: sessionID, ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: paymentStatus, PaymentIntent: &stripe.PaymentIntent{Status: intentStatus}}, nil
					},
				}
				handler := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
				original, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
				if err != nil {
					t.Fatal(err)
				}
				if err := handler.catchup(ctx); err != nil {
					t.Fatal(err)
				}
				originalTrial := *handler.eligibleAccounts["account-1"]
				if err := handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: original.CheckoutSessionID}); err != nil {
					t.Fatal(err)
				}
				if outcome == "revoked" {
					intentStatus = stripe.PaymentIntentStatusRequiresPaymentMethod
					if err := handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: original.CheckoutSessionID}); err != nil {
						t.Fatal(err)
					}
				}
				if restart {
					handler = NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
				}
				if err := handler.catchup(ctx); err != nil {
					t.Fatal(err)
				}
				pending, exists := handler.sessionInfoByAccount["account-1"]
				if exists != (outcome == "processing") {
					t.Fatalf("pending session=%+v for %s", pending, outcome)
				}
				if outcome == "processing" && pending.CheckoutSessionID != original.CheckoutSessionID {
					t.Fatal("processing checkout reference lost")
				}
				if outcome == "revoked" || outcome == "failed without provisional" {
					if !reflect.DeepEqual(*handler.eligibleAccounts["account-1"], originalTrial) {
						t.Fatal("checkout cleanup changed the original trial")
					}
				}
				var wantEvents []eventlog.EventType
				switch outcome {
				case "paid":
					wantEvents = []eventlog.EventType{events.TypePerpetualLicenseGranted}
				case "processing":
					wantEvents = []eventlog.EventType{events.TypeProvisionalLicenseGranted}
				case "revoked":
					wantEvents = []eventlog.EventType{events.TypeProvisionalLicenseGranted, events.TypeProvisionalLicenseRevoked}
				case "failed without provisional":
					wantEvents = []eventlog.EventType{events.TypeStripeCheckoutSessionEnded}
				}
				iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
				var gotEvents []eventlog.EventType
				for iterator.Next(ctx) {
					event := iterator.Event()
					if event.Type == events.TypeAccountCreatedV2 || event.Type == events.TypeStripeCheckoutSessionStarted {
						continue
					}
					gotEvents = append(gotEvents, event.Type)
					var sessionID string
					if event.Type == events.TypeStripeCheckoutSessionEnded {
						var detail events.StripeCheckoutSessionEndedDetail
						if err := json.Unmarshal(event.Data, &detail); err != nil {
							t.Fatal(err)
						}
						sessionID = detail.SessionID
					} else {
						var detail events.LicenseEventDetail
						if err := json.Unmarshal(event.Data, &detail); err != nil {
							t.Fatal(err)
						}
						sessionID = detail.StripeCheckoutSessionID
					}
					if sessionID != original.CheckoutSessionID {
						t.Fatalf("event %s session=%q", event.Type, sessionID)
					}
				}
				if err := iterator.Err(); err != nil {
					t.Fatal(err)
				}
				if !reflect.DeepEqual(gotEvents, wantEvents) {
					t.Fatalf("events=%v, want %v", gotEvents, wantEvents)
				}
				cursor := handler.cursor
				// Re-observing the same result is idempotent, including after restart.
				if err := handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: original.CheckoutSessionID}); err != nil {
					t.Fatal(err)
				}
				if iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{FromCursor: cursor}); iterator.Next(ctx) {
					t.Fatalf("duplicate outcome appended %s", iterator.Event().Type)
				}
				if outcome == "paid" {
					if _, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"}); !errors.Is(err, ErrAccountIneligible) {
						t.Fatalf("paid account checkout: %v", err)
					}
				}
				if outcome == "revoked" || outcome == "failed without provisional" {
					output, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
					if err != nil || output.CheckoutSessionID == original.CheckoutSessionID || creates != 2 {
						t.Fatalf("retry output=%+v err=%v creates=%d", output, err, creates)
					}
				}
			})
		}
	}
}

func TestOldCheckoutEndDoesNotRemoveNewSessionInfo(t *testing.T) {
	for _, eventType := range []eventlog.EventType{events.TypeStripeCheckoutSessionEnded, events.TypePerpetualLicenseGranted, events.TypeProvisionalLicenseRevoked} {
		t.Run(string(eventType), func(t *testing.T) {
			ctx := context.Background()
			log := newRestartTestLog(t)
			for _, sessionID := range []string{"cs_old", "cs_new"} {
				data, _ := json.Marshal(events.StripeCheckoutSessionStartedDetail{SessionID: sessionID, SessionExpiresAt: time.Now().Add(time.Hour).Unix()})
				if _, err := log.Append(ctx, eventlog.AppendInput{Type: events.TypeStripeCheckoutSessionStarted, AccountID: "account-1", Data: data}); err != nil {
					t.Fatal(err)
				}
			}
			var detail interface{} = events.LicenseEventDetail{StripeCheckoutSessionID: "cs_old"}
			if eventType == events.TypeStripeCheckoutSessionEnded {
				detail = events.StripeCheckoutSessionEndedDetail{SessionID: "cs_old"}
			}
			data, err := json.Marshal(detail)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := log.Append(ctx, eventlog.AppendInput{Type: eventType, AccountID: "account-1", Data: data}); err != nil {
				t.Fatal(err)
			}
			handler := NewCommandHandler(NewCommandHandlerInput{EventLog: log})
			if err := handler.catchup(ctx); err != nil {
				t.Fatal(err)
			}
			if info := handler.sessionInfoByAccount["account-1"]; info == nil || info.CheckoutSessionID != "cs_new" {
				t.Fatalf("new checkout removed by older event: %+v", info)
			}
		})
	}
}

func TestRevokeNonProvisionalLicenseLeavesCheckoutForCallerToEnd(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	data, _ := json.Marshal(events.StripeCheckoutSessionStartedDetail{SessionID: "cs_pending", SessionExpiresAt: time.Now().Add(time.Hour).Unix()})
	if _, err := log.Append(ctx, eventlog.AppendInput{Type: events.TypeStripeCheckoutSessionStarted, AccountID: "account-1", Data: data}); err != nil {
		t.Fatal(err)
	}
	var appendedTypes []eventlog.EventType
	handler := NewCommandHandler(NewCommandHandlerInput{EventLog: &interceptedPaymentEventLog{EventLog: log, append: func(ctx context.Context, input eventlog.AppendInput) (*eventlog.Event, error) {
		appendedTypes = append(appendedTypes, input.Type)
		return log.Append(ctx, input)
	}}})
	if err := handler.revokeProvisionalLicense(ctx, "account-1", "cs_pending"); !errors.Is(err, ErrLicenseNotProvisional) {
		t.Fatalf("revoke error=%v, want ErrLicenseNotProvisional", err)
	}
	if len(appendedTypes) != 0 || handler.sessionInfoByAccount["account-1"] == nil {
		t.Fatal("revoke changed checkout without a provisional license")
	}
	if err := handler.endCheckoutSession(ctx, "account-1", "cs_older"); err != nil {
		t.Fatal(err)
	}
	if len(appendedTypes) != 0 {
		t.Fatal("ending an older checkout appended an event for the current attempt")
	}
	for attempt := 0; attempt < 2; attempt++ {
		if err := handler.endCheckoutSession(ctx, "account-1", "cs_pending"); err != nil {
			t.Fatal(err)
		}
	}
	if len(appendedTypes) != 1 || appendedTypes[0] != events.TypeStripeCheckoutSessionEnded {
		t.Fatalf("appended events=%v, want one checkout-ended event", appendedTypes)
	}
	if handler.sessionInfoByAccount["account-1"] != nil {
		t.Fatal("ended checkout still pending after catch-up")
	}
}

func TestCheckoutEndedPersistenceFailureCanRetry(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	data, _ := json.Marshal(events.StripeCheckoutSessionStartedDetail{SessionID: "cs_failed", SessionExpiresAt: time.Now().Add(time.Hour).Unix()})
	if _, err := log.Append(ctx, eventlog.AppendInput{Type: events.TypeStripeCheckoutSessionStarted, AccountID: "account-1", Data: data}); err != nil {
		t.Fatal(err)
	}
	appendError := errors.New("could not persist checkout end")
	attempts := 0
	handler := NewCommandHandler(NewCommandHandlerInput{EventLog: &interceptedPaymentEventLog{EventLog: log, append: func(ctx context.Context, input eventlog.AppendInput) (*eventlog.Event, error) {
		attempts++
		if attempts == 1 {
			return nil, appendError
		}
		return log.Append(ctx, input)
	}}})
	session := &stripe.CheckoutSession{ID: "cs_failed", ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid, PaymentIntent: &stripe.PaymentIntent{Status: stripe.PaymentIntentStatusRequiresPaymentMethod}}
	if err := handler.fulfillCheckout(ctx, session); !errors.Is(err, appendError) {
		t.Fatalf("persistence error=%v", err)
	}
	if handler.sessionInfoByAccount["account-1"] == nil {
		t.Fatal("checkout cleared before its end was durable")
	}
	if err := handler.fulfillCheckout(ctx, session); err != nil {
		t.Fatal(err)
	}
	restarted := NewCommandHandler(NewCommandHandlerInput{EventLog: log})
	if err := restarted.catchup(ctx); err != nil {
		t.Fatal(err)
	}
	if restarted.sessionInfoByAccount["account-1"] != nil {
		t.Fatal("durable end did not survive restart")
	}
}
