package paymentrepository

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
)

func TestDifferentSessionsCanSyncConcurrently(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	log := newRestartTestLog(t)
	entered := make(chan string, 2)
	release := make(chan struct{})
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: log,
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{retrieve: func(ctx context.Context, id string) (*stripe.CheckoutSession, error) {
			entered <- id
			select {
			case <-release:
				return &stripe.CheckoutSession{ID: id, Status: stripe.CheckoutSessionStatusOpen}, nil
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}},
	})
	results := make(chan error, 2)
	for _, id := range []string{"cs_one", "cs_two"} {
		go func() { results <- handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: id}) }()
	}
	seen := map[string]bool{}
	for i := 0; i < 2; i++ {
		select {
		case id := <-entered:
			seen[id] = true
		case <-ctx.Done():
			t.Fatal("both sessions must enter Retrieve before either is released")
		}
	}
	close(release)
	if !seen["cs_one"] || !seen["cs_two"] {
		t.Fatalf("retrieved sessions=%v", seen)
	}
	for i := 0; i < 2; i++ {
		select {
		case err := <-results:
			if err != nil {
				t.Fatal(err)
			}
		case <-ctx.Done():
			t.Fatal("sync did not finish")
		}
	}
}

func TestRetrieveFailureAllowsSyncRetry(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	retrieveError := errors.New("retrieve failed")
	var retrieves int
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: log,
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
			retrieves++
			if retrieves == 1 {
				return nil, retrieveError
			}
			return &stripe.CheckoutSession{ID: id, ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: stripe.CheckoutSessionPaymentStatusPaid}, nil
		}},
	})
	input := SyncCheckoutSessionInput{CheckoutSessionID: "cs_retry"}
	if err := handler.SyncCheckoutSession(ctx, input); !errors.Is(err, retrieveError) {
		t.Fatalf("first sync error=%v, want %v", err, retrieveError)
	}
	if len(handler.syncInProgress) != 0 {
		t.Fatal("failed Retrieve left sync in progress")
	}
	if err := handler.SyncCheckoutSession(ctx, input); err != nil {
		t.Fatal(err)
	}
	if retrieves != 2 {
		t.Fatalf("Retrieve calls=%d, want 2", retrieves)
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
	var grants int
	for iterator.Next(ctx) {
		if iterator.Event().Type == events.TypePerpetualLicenseGranted {
			grants++
		}
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
	if grants != 1 {
		t.Fatalf("perpetual grants=%d, want 1", grants)
	}
}

func TestSyncCatchesUpEventsArrivingDuringRetrieve(t *testing.T) {
	for _, test := range []struct {
		name            string
		arrivals        []eventlog.AppendInput
		paymentStatus   stripe.CheckoutSessionPaymentStatus
		wantEligible    bool
		wantProvisional bool
		wantGrants      int
	}{
		{name: "account created", arrivals: []eventlog.AppendInput{{Type: events.TypeAccountCreatedV2, Data: []byte(`{"account_id":"account-late"}`)}}, paymentStatus: stripe.CheckoutSessionPaymentStatusPaid, wantGrants: 1},
		{name: "perpetual granted", arrivals: []eventlog.AppendInput{{Type: events.TypeAccountCreatedV2, Data: []byte(`{"account_id":"account-late"}`)}, {Type: events.TypePerpetualLicenseGranted, AccountID: "account-late"}}, paymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid, wantGrants: 1},
		{name: "provisional granted", arrivals: []eventlog.AppendInput{{Type: events.TypeAccountCreatedV2, Data: []byte(`{"account_id":"account-late"}`)}, {Type: events.TypeProvisionalLicenseGranted, AccountID: "account-late"}}, paymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid, wantEligible: true, wantProvisional: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			ctx := context.Background()
			log := newRestartTestLog(t)
			handler := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: &checkoutSessionRepositoryStub{
				retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
					// The sync preflight has already caught up. Append while the external
					// call is running, before returning the snapshot for fulfillment.
					for _, input := range test.arrivals {
						if _, err := log.Append(ctx, input); err != nil {
							return nil, err
						}
					}
					return &stripe.CheckoutSession{ID: id, ClientReferenceID: "account-late", Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: test.paymentStatus, PaymentIntent: &stripe.PaymentIntent{ID: "pi_late", Status: stripe.PaymentIntentStatusProcessing}}, nil
				},
			}})
			if err := handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_late"}); err != nil {
				t.Fatal(err)
			}
			if err := handler.catchup(ctx); err != nil {
				t.Fatal(err)
			}
			license, eligible := handler.eligibleAccounts["account-late"]
			if eligible != test.wantEligible {
				t.Fatalf("eligible=%v, want %v; license=%+v", eligible, test.wantEligible, license)
			}
			if test.wantProvisional && (license == nil || license.Type != models.LicenseTypeProvisional) {
				t.Fatalf("license=%+v, want provisional", license)
			}
			iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
			var grants, provisionalGrants int
			for iterator.Next(ctx) {
				switch iterator.Event().Type {
				case events.TypePerpetualLicenseGranted:
					grants++
				case events.TypeProvisionalLicenseGranted:
					provisionalGrants++
				}
			}
			if err := iterator.Err(); err != nil {
				t.Fatal(err)
			}
			if grants != test.wantGrants {
				t.Errorf("perpetual grants=%d, want %d", grants, test.wantGrants)
			}
			wantProvisionalGrants := 0
			if test.wantProvisional {
				wantProvisionalGrants = 1
			}
			if provisionalGrants != wantProvisionalGrants {
				t.Errorf("provisional grants=%d, want %d", provisionalGrants, wantProvisionalGrants)
			}
		})
	}
}

func TestLicensePersistenceFailureConvergesOnRetry(t *testing.T) {
	for _, restart := range []bool{false, true} {
		name := "same handler"
		if restart {
			name = "fresh handler"
		}
		t.Run(name, func(t *testing.T) {
			for _, transition := range []struct {
				name          string
				provisional   bool
				paymentStatus stripe.CheckoutSessionPaymentStatus
				intentStatus  stripe.PaymentIntentStatus
				wantType      models.LicenseType
				wantEvent     eventlog.EventType
			}{
				{name: "perpetual grant", paymentStatus: stripe.CheckoutSessionPaymentStatusPaid, wantType: models.LicenseTypePerpetual, wantEvent: events.TypePerpetualLicenseGranted},
				{name: "provisional grant", paymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid, intentStatus: stripe.PaymentIntentStatusProcessing, wantType: models.LicenseTypeProvisional, wantEvent: events.TypeProvisionalLicenseGranted},
				{name: "provisional revoke", provisional: true, paymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid, intentStatus: stripe.PaymentIntentStatusRequiresPaymentMethod, wantType: models.LicenseTypeTrial, wantEvent: events.TypeProvisionalLicenseRevoked},
			} {
				t.Run(transition.name, func(t *testing.T) {
					ctx := context.Background()
					log := newRestartTestLog(t)
					if transition.provisional {
						if _, err := log.Append(ctx, eventlog.AppendInput{Type: events.TypeProvisionalLicenseGranted, AccountID: "account-1"}); err != nil {
							t.Fatal(err)
						}
					}
					appendError := errors.New("license persistence failed")
					var attempts int
					intercepted := &interceptedPaymentEventLog{EventLog: log, append: func(ctx context.Context, input eventlog.AppendInput) (*eventlog.Event, error) {
						attempts++
						if attempts == 1 {
							return nil, appendError
						}
						return log.Append(ctx, input)
					}}
					var retrieves int
					repository := &checkoutSessionRepositoryStub{retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
						retrieves++
						return &stripe.CheckoutSession{ID: id, ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: transition.paymentStatus, PaymentIntent: &stripe.PaymentIntent{ID: "pi_persist", Status: transition.intentStatus}}, nil
					}}
					handler := NewCommandHandler(NewCommandHandlerInput{EventLog: intercepted, CheckoutSessionRepository: repository})
					if err := handler.catchup(ctx); err != nil {
						t.Fatal(err)
					}
					cursor := handler.cursor
					before := *handler.eligibleAccounts["account-1"]
					input := SyncCheckoutSessionInput{CheckoutSessionID: "cs_persist"}
					if err := handler.SyncCheckoutSession(ctx, input); !errors.Is(err, appendError) {
						t.Fatalf("first sync error=%v, want %v", err, appendError)
					}
					if len(handler.syncInProgress) != 0 {
						t.Fatal("append failure left sync in progress")
					}
					if err := handler.catchup(ctx); err != nil {
						t.Fatal(err)
					}
					if after := handler.eligibleAccounts["account-1"]; after == nil || *after != before || handler.cursor != cursor {
						t.Fatal("failed append changed projected state")
					}
					if restart {
						handler = NewCommandHandler(NewCommandHandlerInput{EventLog: intercepted, CheckoutSessionRepository: repository})
					}
					for i := 0; i < 2; i++ {
						if err := handler.SyncCheckoutSession(ctx, input); err != nil {
							t.Fatal(err)
						}
					}
					replay := NewCommandHandler(NewCommandHandlerInput{EventLog: log})
					if err := replay.catchup(ctx); err != nil {
						t.Fatal(err)
					}
					license := replay.eligibleAccounts["account-1"]
					if transition.wantType == models.LicenseTypePerpetual {
						if license != nil {
							t.Fatalf("paid account still eligible: %+v", license)
						}
					} else if license == nil || license.Type != transition.wantType {
						t.Fatalf("license=%+v, want %s", license, transition.wantType)
					}
					if transition.wantType == models.LicenseTypeTrial && license.StartUnixSeconds != before.ProvisionalLicense.TrialStartUnixSeconds {
						t.Error("revocation lost trial start")
					}
					iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{FromCursor: cursor})
					var writes int
					for iterator.Next(ctx) {
						if event := iterator.Event(); event.Type != transition.wantEvent {
							t.Errorf("unexpected event %s", event.Type)
						}
						writes++
					}
					if err := iterator.Err(); err != nil {
						t.Fatal(err)
					}
					if writes != 1 || attempts != 2 || retrieves != 3 {
						t.Fatalf("writes=%d attempts=%d retrieves=%d; want 1, 2, 3", writes, attempts, retrieves)
					}
				})
			}
		})
	}
}

func TestSyncReturnsPaymentOutcome(t *testing.T) {
	for _, test := range []struct {
		name          string
		status        stripe.CheckoutSessionStatus
		paymentStatus stripe.CheckoutSessionPaymentStatus
		intentStatus  stripe.PaymentIntentStatus
		want          SyncCheckoutSessionOutput
	}{
		{name: "paid", status: stripe.CheckoutSessionStatusComplete, paymentStatus: stripe.CheckoutSessionPaymentStatusPaid, want: SyncCheckoutSessionOutput{Paid: true}},
		{name: "processing", status: stripe.CheckoutSessionStatusComplete, paymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid, intentStatus: stripe.PaymentIntentStatusProcessing, want: SyncCheckoutSessionOutput{Processing: true}},
		{name: "failed", status: stripe.CheckoutSessionStatusComplete, paymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid, intentStatus: stripe.PaymentIntentStatusRequiresPaymentMethod},
		{name: "open", status: stripe.CheckoutSessionStatusOpen},
		{name: "expired", status: stripe.CheckoutSessionStatusExpired},
	} {
		t.Run(test.name, func(t *testing.T) {
			handler := NewCommandHandler(NewCommandHandlerInput{EventLog: newRestartTestLog(t), CheckoutSessionRepository: &checkoutSessionRepositoryStub{
				retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
					return &stripe.CheckoutSession{ID: id, ClientReferenceID: "account-1", Status: test.status, PaymentStatus: test.paymentStatus, PaymentIntent: &stripe.PaymentIntent{ID: "pi_outcome", Status: test.intentStatus}}, nil
				},
			}})
			output, err := handler.SyncCheckoutSessionWithResult(context.Background(), SyncCheckoutSessionInput{CheckoutSessionID: "cs_outcome"})
			if err != nil {
				t.Fatal(err)
			}
			if *output != test.want {
				t.Fatalf("outcome=%+v, want %+v", *output, test.want)
			}
		})
	}
}

func TestConcurrentSyncDoesNotReportPaymentSuccess(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	entered := make(chan struct{})
	release := make(chan struct{})
	var retrieves int
	handler := NewCommandHandler(NewCommandHandlerInput{EventLog: newRestartTestLog(t), CheckoutSessionRepository: &checkoutSessionRepositoryStub{
		retrieve: func(ctx context.Context, id string) (*stripe.CheckoutSession, error) {
			retrieves++
			close(entered)
			select {
			case <-release:
				return &stripe.CheckoutSession{ID: id, ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: stripe.CheckoutSessionPaymentStatusPaid}, nil
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		},
	}})
	input := SyncCheckoutSessionInput{CheckoutSessionID: "cs_concurrent"}
	finished := make(chan error, 1)
	go func() { finished <- handler.SyncCheckoutSession(ctx, input) }()
	select {
	case <-entered:
	case <-ctx.Done():
		t.Fatal("Retrieve did not start")
	}
	output, err := handler.SyncCheckoutSessionWithResult(ctx, input)
	if err != nil || output.Paid || !output.Processing {
		t.Fatalf("concurrent outcome=%+v err=%v", output, err)
	}
	close(release)
	select {
	case err := <-finished:
		if err != nil {
			t.Fatal(err)
		}
	case <-ctx.Done():
		t.Fatal("sync did not finish")
	}
	if retrieves != 1 {
		t.Fatalf("Retrieve calls=%d, want 1", retrieves)
	}
}
