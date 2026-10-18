package paymentrepository

import (
	"context"
	"encoding/json"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
)

func TestDifferentAccountsCanCreateConcurrently(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	log := newRestartTestLog(t)
	if _, err := log.Append(ctx, eventlog.AppendInput{
		Type: events.TypeAccountCreatedV2, Data: json.RawMessage(`{"account_id":"account-2"}`),
	}); err != nil {
		t.Fatal(err)
	}
	entered := make(chan string, 2)
	release := make(chan struct{})
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: log,
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{
			create: func(ctx context.Context, accountID string) (*stripe.CheckoutSession, error) {
				entered <- accountID
				select {
				case <-release:
					return &stripe.CheckoutSession{
						ID: "cs_" + accountID, URL: "https://checkout.stripe.com/" + accountID,
						ExpiresAt: time.Now().Add(time.Hour).Unix(),
					}, nil
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			},
		},
	})
	type result struct {
		accountID string
		output    *StartCheckoutSessionOutput
		err       error
	}
	results := make(chan result, 2)
	for _, accountID := range []string{"account-1", "account-2"} {
		go func() {
			output, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: accountID})
			results <- result{accountID, output, err}
		}()
	}
	accounts := make(map[string]bool)
	for i := 0; i < 2; i++ {
		select {
		case accountID := <-entered:
			accounts[accountID] = true
		case <-ctx.Done():
			t.Fatal("both accounts must enter Create before either Create is released")
		}
	}
	close(release)
	if !accounts["account-1"] || !accounts["account-2"] {
		t.Fatalf("expected independent creates for both accounts, got %v", accounts)
	}
	for i := 0; i < 2; i++ {
		select {
		case got := <-results:
			if got.err != nil || got.output == nil || got.output.CheckoutSessionID != "cs_"+got.accountID {
				t.Fatalf("unexpected result for %s: output=%+v err=%v", got.accountID, got.output, got.err)
			}
		case <-ctx.Done():
			t.Fatal("checkout requests did not finish")
		}
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
	var starts int
	for iterator.Next(ctx) {
		event := iterator.Event()
		if event.Type != events.TypeStripeCheckoutSessionStarted {
			continue
		}
		var detail events.StripeCheckoutSessionStartedDetail
		if err := json.Unmarshal(event.Data, &detail); err != nil {
			t.Fatal(err)
		}
		if detail.SessionID != "cs_"+event.AccountID {
			t.Errorf("session %s associated with account %s", detail.SessionID, event.AccountID)
		}
		starts++
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
	if starts != 2 {
		t.Fatalf("expected two started events, got %d", starts)
	}
}

func TestStartCheckoutSessionReusesOnlyUnexpiredSession(t *testing.T) {
	for _, expired := range []bool{false, true} {
		name := "unexpired is reused"
		if expired {
			name = "expired is replaced"
		}
		t.Run(name, func(t *testing.T) {
			ctx := context.Background()
			log := newRestartTestLog(t)
			expiresAt := time.Now().Add(time.Hour).Unix()
			if expired {
				expiresAt = time.Now().Add(-time.Hour).Unix()
			}
			data, err := json.Marshal(events.StripeCheckoutSessionStartedDetail{
				SessionID: "cs_old", CheckoutURL: "https://checkout.stripe.com/old", SessionExpiresAt: expiresAt,
			})
			if err != nil {
				t.Fatal(err)
			}
			started, err := log.Append(ctx, eventlog.AppendInput{
				Type: events.TypeStripeCheckoutSessionStarted, AccountID: "account-1", Data: data,
			})
			if err != nil {
				t.Fatal(err)
			}
			var creates int
			handler := NewCommandHandler(NewCommandHandlerInput{
				EventLog: log,
				CheckoutSessionRepository: &checkoutSessionRepositoryStub{
					create: func(context.Context, string) (*stripe.CheckoutSession, error) {
						creates++
						return &stripe.CheckoutSession{
							ID: "cs_new", URL: "https://checkout.stripe.com/new", ExpiresAt: time.Now().Add(time.Hour).Unix(),
						}, nil
					},
				},
			})
			wantID, wantURL, wantCreates := "cs_old", "https://checkout.stripe.com/old", 0
			if expired {
				wantID, wantURL, wantCreates = "cs_new", "https://checkout.stripe.com/new", 1
			}
			for request := 0; request < 2; request++ {
				output, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
				if err != nil || output == nil || output.CheckoutSessionID != wantID || output.CheckoutURL != wantURL {
					t.Fatalf("request %d: output=%+v err=%v; want session %s", request, output, err, wantID)
				}
			}
			if creates != wantCreates {
				t.Errorf("Create calls=%d, want %d", creates, wantCreates)
			}
			iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{FromCursor: started.LogicalClock})
			var appended int
			for iterator.Next(ctx) {
				if event := iterator.Event(); event.Type != events.TypeStripeCheckoutSessionStarted || event.AccountID != "account-1" {
					t.Errorf("unexpected event: type=%s account=%s", event.Type, event.AccountID)
				}
				appended++
			}
			if err := iterator.Err(); err != nil {
				t.Fatal(err)
			}
			if appended != wantCreates {
				t.Errorf("new started events=%d, want %d", appended, wantCreates)
			}
		})
	}
}

func TestCreateFailureReachesWaitersAndAllowsRetry(t *testing.T) {
	testSharedCheckoutFailure(t, false)
}

func TestAppendFailureReachesWaitersAndAllowsRetry(t *testing.T) {
	testSharedCheckoutFailure(t, true)
}

func testSharedCheckoutFailure(t *testing.T, failAppend bool) {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	log := newRestartTestLog(t)
	failureError := errors.New("checkout operation failed")
	var operationLog eventlog.EventLog = log
	var appendAttempts atomic.Int32
	if failAppend {
		operationLog = &interceptedPaymentEventLog{EventLog: log, append: func(ctx context.Context, input eventlog.AppendInput) (*eventlog.Event, error) {
			if appendAttempts.Add(1) == 1 {
				return nil, failureError
			}
			return log.Append(ctx, input)
		}}
	}
	entered := make(chan struct{})
	waiterWaiting := make(chan struct{})
	release := make(chan struct{})
	var creates, reads atomic.Int32
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: &observedPaymentEventLog{EventLog: operationLog, onRead: func() {
			reads.Add(1)
		}},
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{
			create: func(ctx context.Context, _ string) (*stripe.CheckoutSession, error) {
				if creates.Add(1) == 1 {
					close(entered)
					select {
					case <-release:
						if !failAppend {
							return nil, failureError
						}
					case <-ctx.Done():
						return nil, ctx.Err()
					}
				}
				return &stripe.CheckoutSession{
					ID: "cs_retry", URL: "https://checkout.stripe.com/retry", ExpiresAt: time.Now().Add(time.Hour).Unix(),
				}, nil
			},
		},
	})
	type result struct {
		output *StartCheckoutSessionOutput
		err    error
	}
	results := make(chan result, 2)
	start := func(callCtx context.Context) {
		output, err := handler.StartCheckoutSession(callCtx, StartCheckoutSessionInput{AccountID: "account-1"})
		results <- result{output, err}
	}
	go start(ctx)
	select {
	case <-entered:
	case <-ctx.Done():
		t.Fatal("first caller did not enter Create")
	}
	go start(&checkoutWaitContext{Context: ctx, observed: waiterWaiting})
	select {
	case <-waiterWaiting:
		if reads.Load() != 1 {
			t.Fatalf("waiting caller repeated preflight: reads=%d", reads.Load())
		}
	case <-ctx.Done():
		t.Fatal("second caller did not join the future")
	}
	close(release)
	for i := 0; i < 2; i++ {
		select {
		case got := <-results:
			if !errors.Is(got.err, failureError) || got.output != nil {
				t.Errorf("shared creation failure: output=%+v err=%v, want original error", got.output, got.err)
			}
		case <-ctx.Done():
			t.Fatal("creation failure left a caller blocked")
		}
	}
	if got := creates.Load(); got != 1 {
		t.Fatalf("expected one shared failed Create, got %d", got)
	}
	output, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
	if err != nil || output == nil || output.CheckoutSessionID != "cs_retry" || creates.Load() != 2 {
		t.Fatalf("retry did not start fresh: output=%+v err=%v creates=%d", output, err, creates.Load())
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
	var starts int
	for iterator.Next(ctx) {
		if iterator.Event().Type == events.TypeStripeCheckoutSessionStarted {
			starts++
		}
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
	if starts != 1 {
		t.Errorf("expected only the successful retry to emit a started event, got %d", starts)
	}
}

type interceptedPaymentEventLog struct {
	eventlog.EventLog
	append func(context.Context, eventlog.AppendInput) (*eventlog.Event, error)
}

func TestCheckoutSuccessWaitsForStartedEventPersistence(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	log := newRestartTestLog(t)
	createEntered := make(chan struct{})
	releaseCreate := make(chan struct{})
	appendEntered := make(chan struct{})
	releaseAppend := make(chan struct{})
	handler := NewCommandHandler(NewCommandHandlerInput{
		EventLog: &interceptedPaymentEventLog{EventLog: log, append: func(ctx context.Context, input eventlog.AppendInput) (*eventlog.Event, error) {
			close(appendEntered)
			select {
			case <-releaseAppend:
				return log.Append(ctx, input)
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}},
		CheckoutSessionRepository: &checkoutSessionRepositoryStub{
			create: func(ctx context.Context, _ string) (*stripe.CheckoutSession, error) {
				close(createEntered)
				select {
				case <-releaseCreate:
					return &stripe.CheckoutSession{ID: "cs_persist", URL: "https://checkout.stripe.com/persist", ExpiresAt: time.Now().Add(time.Hour).Unix()}, nil
				case <-ctx.Done():
					return nil, ctx.Err()
				}
			},
		},
	})
	finished := make(chan error, 1)
	go func() {
		output, err := handler.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
		if err == nil && (output == nil || output.CheckoutSessionID != "cs_persist") {
			err = errors.New("unexpected checkout output")
		}
		finished <- err
	}()
	select {
	case <-createEntered:
	case <-ctx.Done():
		t.Fatal("Create did not start")
	}
	// Inspect the pending full result before allowing Create to return.
	handler.mutex.Lock()
	pending := handler.startCheckoutSessionFutureForAccount["account-1"]
	handler.mutex.Unlock()
	if pending == nil {
		t.Fatal("checkout has no pending result future")
	}
	close(releaseCreate)
	select {
	case <-appendEntered:
	case <-ctx.Done():
		t.Fatal("Append did not start")
	}
	select {
	case <-pending.Ready():
		t.Error("shared checkout resolved before persistence")
	default:
	}
	select {
	case err := <-finished:
		t.Fatalf("checkout returned before persistence: %v", err)
	default:
	}
	close(releaseAppend)
	select {
	case err := <-finished:
		if err != nil {
			t.Fatal(err)
		}
	case <-ctx.Done():
		t.Fatal("checkout did not finish after persistence")
	}
	info, err := pending.Result()
	if err != nil || info == nil || info.CheckoutSessionID != "cs_persist" {
		t.Fatalf("shared result after persistence: info=%+v err=%v", info, err)
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
	var starts int
	for iterator.Next(ctx) {
		if iterator.Event().Type == events.TypeStripeCheckoutSessionStarted {
			starts++
		}
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
	if starts != 1 {
		t.Fatalf("expected one persisted started event, got %d", starts)
	}
}

func (log *interceptedPaymentEventLog) Append(ctx context.Context, input eventlog.AppendInput) (*eventlog.Event, error) {
	return log.append(ctx, input)
}
