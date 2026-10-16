package paymentrepository

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
)

func TestV2AccountCreationReplaySetsTrialLicense(t *testing.T) {
	for _, test := range []struct {
		name        string
		eventType   eventlog.EventType
		detail      interface{}
		licenseType models.LicenseType
	}{
		{"v2 is trial", events.TypeAccountCreatedV2, events.AccountCreatedV2Detail{AccountID: "account-1"}, models.LicenseTypeTrial},
	} {
		t.Run(test.name, func(t *testing.T) {
			ctx := context.Background()
			log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: t.TempDir()})
			data, err := json.Marshal(test.detail)
			if err != nil {
				t.Fatal(err)
			}
			created, err := log.Append(ctx, eventlog.AppendInput{Type: test.eventType, Data: data})
			if err != nil {
				t.Fatal(err)
			}
			handler := NewCommandHandler(NewCommandHandlerInput{
				EventLog: log, CheckoutSessionRepository: &checkoutSessionRepositoryStub{},
			})
			if err := handler.catchup(ctx); err != nil {
				t.Fatal(err)
			}
			license := handler.eligibleAccounts["account-1"]
			if license == nil {
				t.Fatal("account creation was not projected into eligibleAccounts")
			}
			if license.Type != test.licenseType || license.StartUnixSeconds != created.UnixTimestamp {
				t.Fatalf("license = %+v, want type %s starting at %d", license, test.licenseType, created.UnixTimestamp)
			}
			if license.ProvisionalLicense != nil {
				t.Fatal("initial license should not have provisional metadata")
			}
		})
	}
}

func TestStartCheckoutSessionRejectsUnknownAccount(t *testing.T) {
	ctx := context.Background()
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: t.TempDir()})
	var creates int
	repository := &checkoutSessionRepositoryStub{
		create: func(_ context.Context, accountID string) (*stripe.CheckoutSession, error) {
			creates++
			return &stripe.CheckoutSession{
				ID: "cs_test_unknown", ClientReferenceID: accountID,
				URL:       "https://checkout.stripe.com/test-session",
				ExpiresAt: time.Now().Add(time.Hour).Unix(),
			}, nil
		},
	}
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: log, CheckoutSessionRepository: repository,
	})
	output, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "unknown-account"})
	if !errors.Is(err, ErrAccountIneligible) {
		t.Errorf("expected ErrAccountIneligible, got %v (output=%+v)", err, output)
	}
	if output != nil {
		t.Errorf("unknown account received a checkout session: %+v", output)
	}
	if creates != 0 {
		t.Errorf("unknown account must be rejected before Create; got %d create calls", creates)
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
	for iterator.Next(ctx) {
		t.Errorf("unknown account emitted event %s", iterator.Event().Type)
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
}

func TestStartCheckoutSessionRejectsV1Account(t *testing.T) {
	ctx := context.Background()
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: t.TempDir()})
	data, err := json.Marshal(events.AccountCreatedV1Detail{AccountID: "legacy-account"})
	if err != nil {
		t.Fatal(err)
	}
	created, err := log.Append(ctx, eventlog.AppendInput{Type: events.TypeAccountCreatedV1, Data: data})
	if err != nil {
		t.Fatal(err)
	}
	var creates int
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: log,
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{
			create: func(context.Context, string) (*stripe.CheckoutSession, error) {
				creates++
				return nil, fmt.Errorf("unexpected Create call for v1 account")
			},
		},
	})
	output, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "legacy-account"})
	if !errors.Is(err, ErrAccountIneligible) || output != nil || creates != 0 {
		t.Fatalf("v1 checkout: output=%+v error=%v creates=%d; want ErrAccountIneligible without Create", output, err, creates)
	}
	if _, exists := handler.eligibleAccounts["legacy-account"]; exists {
		t.Error("payment repository should not project v1 accounts")
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{FromCursor: created.LogicalClock})
	for iterator.Next(ctx) {
		t.Errorf("v1 account emitted payment event %s", iterator.Event().Type)
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
}

func TestStartCheckoutSessionRejectsPerpetualAccount(t *testing.T) {
	ctx := context.Background()
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: t.TempDir()})
	data, err := json.Marshal(events.AccountCreatedV2Detail{AccountID: "account-1"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := log.Append(ctx, eventlog.AppendInput{Type: events.TypeAccountCreatedV2, Data: data}); err != nil {
		t.Fatal(err)
	}
	grant, err := log.Append(ctx, eventlog.AppendInput{
		Type: events.TypePerpetualLicenseGranted, AccountID: "account-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	var creates int
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: log,
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{
			create: func(_ context.Context, accountID string) (*stripe.CheckoutSession, error) {
				creates++
				return &stripe.CheckoutSession{
					ID: "cs_test_repeat_purchase", ClientReferenceID: accountID,
					URL:       "https://checkout.stripe.com/test-session",
					ExpiresAt: time.Now().Add(time.Hour).Unix(),
				}, nil
			},
		},
	})
	output, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
	if _, eligible := handler.eligibleAccounts["account-1"]; eligible {
		t.Error("perpetual grant should remove the account from eligibleAccounts")
	}
	if err == nil {
		t.Errorf("expected an error preventing a second purchase, got nil (output=%+v)", output)
	}
	if output != nil {
		t.Errorf("perpetual account received a checkout session: %+v", output)
	}
	if creates != 0 {
		t.Errorf("perpetual account must be rejected before Create; got %d create calls", creates)
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{FromCursor: grant.LogicalClock})
	for iterator.Next(ctx) {
		t.Errorf("perpetual account emitted payment event %s", iterator.Event().Type)
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
}

func TestSyncCheckoutSessionPaidSessionGrantsPerpetualLicense(t *testing.T) {
	ctx := context.Background()
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: t.TempDir()})
	accountData, err := json.Marshal(events.AccountCreatedV2Detail{AccountID: "account-1"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := log.Append(ctx, eventlog.AppendInput{
		Type: events.TypeAccountCreatedV2, AccountID: "account-1", Data: accountData,
	}); err != nil {
		t.Fatal(err)
	}
	checkoutData, err := json.Marshal(events.StripeCheckoutSessionStartedDetail{
		SessionID: "cs_test_1", CheckoutURL: "https://checkout.stripe.com/test-session",
		SessionExpiresAt: time.Now().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	started, err := log.Append(ctx, eventlog.AppendInput{
		Type: events.TypeStripeCheckoutSessionStarted, AccountID: "account-1", Data: checkoutData,
	})
	if err != nil {
		t.Fatal(err)
	}
	repository := &checkoutSessionRepositoryStub{
		retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
			if id != "cs_test_1" {
				t.Errorf("unexpected session ID: %q", id)
			}
			return &stripe.CheckoutSession{
				ID: id, ClientReferenceID: "account-1",
				Status:        stripe.CheckoutSessionStatusComplete,
				PaymentStatus: stripe.CheckoutSessionPaymentStatusPaid,
			}, nil
		},
	}
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: log, CheckoutSessionRepository: repository,
	})
	// Account creation and checkout start precede sync. Catch-up must rebuild
	// the trial account before applying the retrieved paid result.
	if err := handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_test_1"}); err != nil {
		t.Fatalf("sync paid checkout for an existing trial account: %v", err)
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{FromCursor: started.LogicalClock})
	var grants int
	for iterator.Next(ctx) {
		event := iterator.Event()
		if event.Type != events.TypePerpetualLicenseGranted || event.AccountID != "account-1" {
			t.Errorf("unexpected event after sync: type=%s account=%s", event.Type, event.AccountID)
		}
		grants++
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
	if grants != 1 {
		t.Fatalf("expected exactly one perpetual license grant, got %d", grants)
	}
}

func TestSyncCheckoutSessionOnlyOneRetrieveInFlight(t *testing.T) {
	// Hold the first retrieval open while a second sync targets the same
	// session. Channel handshakes establish the ordering without sleeps.
	entered := make(chan struct{})
	release := make(chan struct{})
	var releaseOnce sync.Once
	t.Cleanup(func() { releaseOnce.Do(func() { close(release) }) })
	var retrieves atomic.Int32
	repository := &checkoutSessionRepositoryStub{
		retrieve: func(ctx context.Context, id string) (*stripe.CheckoutSession, error) {
			if retrieves.Add(1) == 1 {
				close(entered)
			}
			select {
			case <-release:
				return &stripe.CheckoutSession{ID: id, Status: stripe.CheckoutSessionStatusOpen}, nil
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		},
	}
	log := &emptyPaymentEventLog{}
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: log, CheckoutSessionRepository: repository,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	startSync := func() <-chan error {
		done := make(chan error, 1)
		go func() {
			defer func() {
				if recovered := recover(); recovered != nil {
					done <- fmt.Errorf("SyncCheckoutSession panicked: %v", recovered)
				}
			}()
			done <- handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_test_1"})
		}()
		return done
	}
	first := startSync()
	select {
	case <-entered:
	case err := <-first:
		t.Fatalf("first sync must reach Retrieve before completing; got %v", err)
	case <-ctx.Done():
		t.Fatal("first sync did not reach Retrieve")
	}

	second := startSync()
	select {
	case err := <-second:
		if err != nil {
			t.Fatalf("overlapping sync: %v", err)
		}
	case <-ctx.Done():
		t.Fatal("overlapping sync should return while the first retrieval is blocked")
	}
	if got := retrieves.Load(); got != 1 {
		t.Fatalf("expected one retrieval in flight, got %d", got)
	}
	releaseOnce.Do(func() { close(release) })
	select {
	case err := <-first:
		if err != nil {
			t.Fatalf("first sync: %v", err)
		}
	case <-ctx.Done():
		t.Fatal("first sync did not finish after retrieval was released")
	}
	if got := log.appends.Load(); got != 0 {
		t.Fatalf("an open session should not emit license events; got %d appends", got)
	}
}

func TestSyncCheckoutSessionRepeatedPaidResultGrantsLicenseOnce(t *testing.T) {
	ctx := context.Background()
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: t.TempDir()})
	accountData, err := json.Marshal(events.AccountCreatedV2Detail{AccountID: "account-1"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := log.Append(ctx, eventlog.AppendInput{
		Type: events.TypeAccountCreatedV2, AccountID: "account-1", Data: accountData,
	}); err != nil {
		t.Fatal(err)
	}
	checkoutData, err := json.Marshal(events.StripeCheckoutSessionStartedDetail{
		SessionID: "cs_test_1", CheckoutURL: "https://checkout.stripe.com/test-session",
		SessionExpiresAt: time.Now().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	started, err := log.Append(ctx, eventlog.AppendInput{
		Type: events.TypeStripeCheckoutSessionStarted, AccountID: "account-1", Data: checkoutData,
	})
	if err != nil {
		t.Fatal(err)
	}
	var retrieves int
	repository := &checkoutSessionRepositoryStub{
		retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
			retrieves++
			return &stripe.CheckoutSession{
				ID: id, ClientReferenceID: "account-1",
				Status:        stripe.CheckoutSessionStatusComplete,
				PaymentStatus: stripe.CheckoutSessionPaymentStatusPaid,
			}, nil
		},
	}
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: log, CheckoutSessionRepository: repository,
	})
	// The second sync observes the same Stripe result after the first grant
	// has been persisted. Catch-up must make that grant effective before the
	// second result is applied, preventing a duplicate event.
	for attempt := 1; attempt <= 2; attempt++ {
		if err := handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_test_1"}); err != nil {
			t.Fatalf("sync %d: %v", attempt, err)
		}
	}
	if retrieves != 2 {
		t.Fatalf("expected both sequential syncs to retrieve the session, got %d", retrieves)
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{FromCursor: started.LogicalClock})
	var grants int
	for iterator.Next(ctx) {
		event := iterator.Event()
		if event.Type != events.TypePerpetualLicenseGranted || event.AccountID != "account-1" {
			t.Errorf("unexpected event: type=%s account=%s", event.Type, event.AccountID)
		}
		grants++
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
	if grants != 1 {
		t.Fatalf("expected exactly one perpetual license grant after two paid syncs, got %d", grants)
	}
}

func TestStartCheckoutSessionConcurrentRequestsShareCreate(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: t.TempDir()})
	created, err := log.Append(ctx, eventlog.AppendInput{
		Type: events.TypeAccountCreatedV2, Data: json.RawMessage(`{"account_id":"account-1"}`),
	})
	if err != nil {
		t.Fatal(err)
	}
	createEntered := make(chan struct{})
	secondPreflight := make(chan struct{})
	release := make(chan struct{})
	var releaseOnce sync.Once
	t.Cleanup(func() { releaseOnce.Do(func() { close(release) }) })
	var reads, creates atomic.Int32
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: &observedPaymentEventLog{EventLog: log, onRead: func() {
			if reads.Add(1) == 2 {
				close(secondPreflight)
			}
		}},
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{
			create: func(ctx context.Context, accountID string) (*stripe.CheckoutSession, error) {
				if creates.Add(1) == 1 {
					close(createEntered)
				}
				select {
				case <-release:
					return &stripe.CheckoutSession{
						ID: "cs_test_shared", ClientReferenceID: accountID,
						URL:       "https://checkout.stripe.com/shared-session",
						ExpiresAt: time.Now().Add(time.Hour).Unix(),
					}, nil
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			},
		},
	})
	type result struct {
		output *StartCheckoutSessionOutput
		err    error
	}
	results := make(chan result, 2)
	start := func() {
		output, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
		results <- result{output, err}
	}
	go start()
	select {
	case <-createEntered:
	case <-ctx.Done():
		t.Fatal("first request did not reach Create")
	}
	go start()
	select {
	case <-secondPreflight:
	case <-ctx.Done():
		t.Fatal("second request could not enter preflight while Create was in flight")
	}
	// The second preflight holds the handler lock when it signals. It must
	// either find the shared future or the first request's persisted session.
	releaseOnce.Do(func() { close(release) })
	for request := 0; request < 2; request++ {
		select {
		case result := <-results:
			if result.err != nil {
				t.Fatalf("checkout request failed: %v", result.err)
			}
			if result.output == nil || result.output.CheckoutSessionID != "cs_test_shared" || result.output.CheckoutURL != "https://checkout.stripe.com/shared-session" {
				t.Fatalf("unexpected shared checkout: %+v", result.output)
			}
		case <-ctx.Done():
			t.Fatal("checkout requests did not finish after Create was released")
		}
	}
	if got := creates.Load(); got != 1 {
		t.Fatalf("expected one Create call, got %d", got)
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{FromCursor: created.LogicalClock})
	var starts int
	for iterator.Next(ctx) {
		event := iterator.Event()
		if event.Type != events.TypeStripeCheckoutSessionStarted || event.AccountID != "account-1" {
			t.Errorf("unexpected event: type=%s account=%s", event.Type, event.AccountID)
		}
		starts++
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
	if starts != 1 {
		t.Fatalf("expected one checkout-started event, got %d", starts)
	}
}

type observedPaymentEventLog struct {
	eventlog.EventLog
	onRead func()
}

func (log *observedPaymentEventLog) GetEventIterator(ctx context.Context, input eventlog.GetEventIteratorInput) eventlog.EventIterator {
	iterator := log.EventLog.GetEventIterator(ctx, input)
	log.onRead()
	return iterator
}

func TestStartCheckoutSessionUsesSameAccountForCreateAndEvent(t *testing.T) {
	ctx := context.Background()
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: t.TempDir()})
	created, err := log.Append(ctx, eventlog.AppendInput{
		Type: events.TypeAccountCreatedV2, Data: json.RawMessage(`{"account_id":"checkout-owner"}`),
	})
	if err != nil {
		t.Fatal(err)
	}
	var createAccountID string
	var creates int
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: log,
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{
			create: func(_ context.Context, accountID string) (*stripe.CheckoutSession, error) {
				creates++
				createAccountID = accountID
				return &stripe.CheckoutSession{
					ID: "cs_test_1", URL: "https://checkout.stripe.com/test-session",
					ExpiresAt: time.Now().Add(time.Hour).Unix(),
				}, nil
			},
		},
	})
	output, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "checkout-owner"})
	if err != nil {
		t.Fatal(err)
	}
	if creates != 1 || createAccountID != "checkout-owner" {
		t.Fatalf("Create received %d calls with account=%q; want one for checkout-owner", creates, createAccountID)
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{FromCursor: created.LogicalClock})
	var starts int
	for iterator.Next(ctx) {
		event := iterator.Event()
		if event.Type != events.TypeStripeCheckoutSessionStarted || event.AccountID != createAccountID {
			t.Errorf("started event type=%s account=%q; want checkout start for Create account %q", event.Type, event.AccountID, createAccountID)
		}
		var detail events.StripeCheckoutSessionStartedDetail
		if err := json.Unmarshal(event.Data, &detail); err != nil {
			t.Fatal(err)
		}
		if output == nil || detail.SessionID != "cs_test_1" || detail.SessionID != output.CheckoutSessionID || detail.CheckoutURL != output.CheckoutURL {
			t.Errorf("started event %+v does not match returned checkout %+v", detail, output)
		}
		starts++
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
	if starts != 1 {
		t.Fatalf("expected one started event, got %d", starts)
	}
}

func TestRecordCheckoutSessionEventReturnsFulfillmentError(t *testing.T) {
	ctx := context.Background()
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: t.TempDir()})
	for _, input := range []eventlog.AppendInput{
		{Type: events.TypeAccountCreatedV2, Data: json.RawMessage(`{"account_id":"account-1"}`)},
		{
			Type: events.TypeStripeCheckoutSessionStarted, AccountID: "account-1",
			Data: json.RawMessage(`{"session_id":"cs_test_1","checkout_url":"https://checkout.stripe.com/test-session","session_expires_at":4102444800}`),
		},
	} {
		if _, err := log.Append(ctx, input); err != nil {
			t.Fatal(err)
		}
	}
	appendError := errors.New("license grant persistence failed")
	failingLog := &appendFailingPaymentEventLog{EventLog: log, err: appendError}
	data, err := json.Marshal(&stripe.CheckoutSession{
		ID: "cs_test_1", ClientReferenceID: "account-1",
		Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: stripe.CheckoutSessionPaymentStatusPaid,
	})
	if err != nil {
		t.Fatal(err)
	}
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: failingLog,
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{
			constructEvent: func([]byte, string) (*stripe.Event, error) {
				return &stripe.Event{
					Type: stripe.EventTypeCheckoutSessionCompleted,
					Data: &stripe.EventData{Raw: data},
				}, nil
			},
		},
	})
	// A valid paid webhook reaches fulfillment, but its license event cannot
	// be saved. Return that error so the HTTP layer can request a Stripe retry.
	err = handler.RecordCheckoutSessionEvent(ctx, RecordCheckoutSessionEventInput{
		Payload: []byte("verified by the fake repository"), Signature: "test-signature",
	})
	if failingLog.appends != 1 {
		t.Fatalf("expected one attempt to persist the grant, got %d", failingLog.appends)
	}
	if !errors.Is(err, appendError) {
		t.Fatalf("expected fulfillment error %q, got %v", appendError, err)
	}
}

type appendFailingPaymentEventLog struct {
	eventlog.EventLog
	err     error
	appends int
}

func (log *appendFailingPaymentEventLog) Append(context.Context, eventlog.AppendInput) (*eventlog.Event, error) {
	log.appends++
	return nil, log.err
}

type checkoutSessionRepositoryStub struct {
	create         func(context.Context, string) (*stripe.CheckoutSession, error)
	retrieve       func(context.Context, string) (*stripe.CheckoutSession, error)
	constructEvent func([]byte, string) (*stripe.Event, error)
}

func (stub *checkoutSessionRepositoryStub) Create(ctx context.Context, accountID string) (*stripe.CheckoutSession, error) {
	if stub.create != nil {
		return stub.create(ctx, accountID)
	}
	return nil, fmt.Errorf("unexpected Create call")
}

func (stub *checkoutSessionRepositoryStub) Retrieve(ctx context.Context, id string) (*stripe.CheckoutSession, error) {
	return stub.retrieve(ctx, id)
}

func (stub *checkoutSessionRepositoryStub) ConstructEvent(payload []byte, signature string) (*stripe.Event, error) {
	if stub.constructEvent != nil {
		return stub.constructEvent(payload, signature)
	}
	return nil, fmt.Errorf("unexpected ConstructEvent call")
}

type emptyPaymentEventLog struct{ appends atomic.Int32 }

func (log *emptyPaymentEventLog) Append(context.Context, eventlog.AppendInput) (*eventlog.Event, error) {
	log.appends.Add(1)
	return nil, fmt.Errorf("unexpected event append")
}

func (*emptyPaymentEventLog) GetEventIterator(context.Context, eventlog.GetEventIteratorInput) eventlog.EventIterator {
	return &eventlog.NullEventIterator{}
}

func (*emptyPaymentEventLog) Wait(ctx context.Context) <-chan struct{} { return ctx.Done() }
