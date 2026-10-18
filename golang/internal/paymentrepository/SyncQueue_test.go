package paymentrepository

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/future"
	"github.com/Ryan-A-B/beddybytes/golang/internal/paymentrepository/internal/checkoutsessions"
	"github.com/stripe/stripe-go/v87"
)

type syncRetrieveCall struct {
	ctx      context.Context
	complete chan syncRetrieveResult
}
type syncRetrieveResult struct {
	session *stripe.CheckoutSession
	err     error
}

func newQueuedSyncTestHandler(t *testing.T, log eventlog.EventLog) (*CommandHandler, <-chan syncRetrieveCall) {
	t.Helper()
	lifetime, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	calls := make(chan syncRetrieveCall, 10)
	handler := NewCommandHandler(NewCommandHandlerInput{Context: lifetime, EventLog: log, CheckoutSessionRepository: &checkoutSessionRepositoryStub{
		parseNotification: func([]byte, string) (*checkoutsessions.Notification, error) {
			return &checkoutsessions.Notification{CheckoutSessionID: "cs_queue"}, nil
		},
		retrieve: func(ctx context.Context, id string) (*stripe.CheckoutSession, error) {
			if id != "cs_queue" {
				t.Errorf("retrieved %q", id)
			}
			call := syncRetrieveCall{ctx: ctx, complete: make(chan syncRetrieveResult, 1)}
			calls <- call
			select {
			case result := <-call.complete:
				return result.session, result.err
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		},
	}})
	return handler, calls
}
func nextSyncRetrieve(t *testing.T, calls <-chan syncRetrieveCall) syncRetrieveCall {
	t.Helper()
	select {
	case call := <-calls:
		return call
	case <-time.After(5 * time.Second):
		t.Fatal("sync did not retrieve")
		return syncRetrieveCall{}
	}
}
func awaitSyncResult(t *testing.T, result *future.Future[*SyncCheckoutSessionOutput]) (*SyncCheckoutSessionOutput, error) {
	t.Helper()
	select {
	case <-result.Ready():
		return result.Result()
	case <-time.After(5 * time.Second):
		t.Fatal("sync did not finish")
		return nil, nil
	}
}
func queuedSession(status stripe.CheckoutSessionPaymentStatus, intent stripe.PaymentIntentStatus) *stripe.CheckoutSession {
	return &stripe.CheckoutSession{ID: "cs_queue", ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: status, PaymentIntent: &stripe.PaymentIntent{Status: intent}}
}

func TestSyncQueueCoalescesAndRetrievesAgainForRequestsDuringEveryPass(t *testing.T) {
	log := newRestartTestLog(t)
	handler, calls := newQueuedSyncTestHandler(t, log)
	input := SyncCheckoutSessionInput{CheckoutSessionID: "cs_queue"}
	first := handler.requestCheckoutSessionSync(input)
	firstCall := nextSyncRetrieve(t, calls)
	second := handler.requestCheckoutSessionSync(input)
	third := handler.requestCheckoutSessionSync(input)
	select {
	case <-second.Ready():
		t.Fatal("queued caller returned before a fresh retrieval")
	default:
	}
	select {
	case <-calls:
		t.Fatal("same session retrieved concurrently")
	default:
	}
	firstCall.complete <- syncRetrieveResult{session: queuedSession(stripe.CheckoutSessionPaymentStatusUnpaid, stripe.PaymentIntentStatusProcessing)}
	secondCall := nextSyncRetrieve(t, calls)
	firstOutput, err := awaitSyncResult(t, first)
	if err != nil || !firstOutput.Processing {
		t.Fatalf("first output=%+v err=%v", firstOutput, err)
	}
	// A request during the second pass must cause a third pass.
	fourth := handler.requestCheckoutSessionSync(input)
	secondCall.complete <- syncRetrieveResult{session: queuedSession(stripe.CheckoutSessionPaymentStatusUnpaid, stripe.PaymentIntentStatusRequiresPaymentMethod)}
	thirdCall := nextSyncRetrieve(t, calls)
	secondOutput, err := awaitSyncResult(t, second)
	if err != nil || secondOutput.Paid || secondOutput.Processing {
		t.Fatalf("second output=%+v err=%v", secondOutput, err)
	}
	thirdOutput, err := awaitSyncResult(t, third)
	if err != nil || thirdOutput != secondOutput {
		t.Fatalf("batch did not share result: %+v %v", thirdOutput, err)
	}
	select {
	case <-fourth.Ready():
		t.Fatal("third-pass waiter returned before retrieval finished")
	default:
	}
	thirdCall.complete <- syncRetrieveResult{session: queuedSession(stripe.CheckoutSessionPaymentStatusPaid, stripe.PaymentIntentStatusSucceeded)}
	fourthOutput, err := awaitSyncResult(t, fourth)
	if err != nil || !fourthOutput.Paid {
		t.Fatalf("last output=%+v err=%v", fourthOutput, err)
	}
	handler.mutex.Lock()
	remaining := len(handler.syncInProgress)
	handler.mutex.Unlock()
	if remaining != 0 {
		t.Fatal("idle runner left state behind")
	}
	// A request after the transition to idle must start a new runner.
	afterIdle := handler.requestCheckoutSessionSync(input)
	nextSyncRetrieve(t, calls).complete <- syncRetrieveResult{session: queuedSession(stripe.CheckoutSessionPaymentStatusPaid, stripe.PaymentIntentStatusSucceeded)}
	if _, err := awaitSyncResult(t, afterIdle); err != nil {
		t.Fatal(err)
	}
	counts := map[eventlog.EventType]int{}
	iterator := log.GetEventIterator(context.Background(), eventlog.GetEventIteratorInput{})
	for iterator.Next(context.Background()) {
		counts[iterator.Event().Type]++
	}
	for _, eventType := range []eventlog.EventType{events.TypeProvisionalLicenseGranted, events.TypeProvisionalLicenseRevoked, events.TypePerpetualLicenseGranted} {
		if counts[eventType] != 1 {
			t.Errorf("%s events=%d", eventType, counts[eventType])
		}
	}
}

func TestSyncQueueRunsPendingPassAfterRetrievalOrPersistenceFailure(t *testing.T) {
	for _, persistence := range []bool{false, true} {
		name := "retrieval"
		if persistence {
			name = "persistence"
		}
		t.Run(name, func(t *testing.T) {
			log := newRestartTestLog(t)
			failure := errors.New("temporary failure")
			var attempts atomic.Int32
			intercepted := &interceptedPaymentEventLog{EventLog: log, append: func(ctx context.Context, input eventlog.AppendInput) (*eventlog.Event, error) {
				if persistence && attempts.Add(1) == 1 {
					return nil, failure
				}
				return log.Append(ctx, input)
			}}
			handler, calls := newQueuedSyncTestHandler(t, intercepted)
			input := SyncCheckoutSessionInput{CheckoutSessionID: "cs_queue"}
			first := handler.requestCheckoutSessionSync(input)
			firstCall := nextSyncRetrieve(t, calls)
			pending := handler.requestCheckoutSessionSync(input)
			result := syncRetrieveResult{session: queuedSession(stripe.CheckoutSessionPaymentStatusPaid, stripe.PaymentIntentStatusSucceeded)}
			if !persistence {
				result.err = failure
			}
			firstCall.complete <- result
			nextSyncRetrieve(t, calls).complete <- syncRetrieveResult{session: queuedSession(stripe.CheckoutSessionPaymentStatusPaid, stripe.PaymentIntentStatusSucceeded)}
			if _, err := awaitSyncResult(t, first); !errors.Is(err, failure) {
				t.Fatalf("error=%v want %v", err, failure)
			}
			if output, err := awaitSyncResult(t, pending); err != nil || !output.Paid {
				t.Fatalf("queued retry=%+v %v", output, err)
			}
		})
	}
}

// Wait for actual HTTP-facing callers to register their follow-up before releasing
// the blocked retrieval. This polls state, not an assumed scheduling delay.
func waitForQueuedSync(t *testing.T, handler *CommandHandler) {
	t.Helper()
	timeout := time.NewTimer(5 * time.Second)
	defer timeout.Stop()
	tick := time.NewTicker(time.Millisecond)
	defer tick.Stop()
	for {
		handler.mutex.Lock()
		state := handler.syncInProgress["cs_queue"]
		queued := state != nil && state.pending != nil
		handler.mutex.Unlock()
		if queued {
			return
		}
		select {
		case <-tick.C:
		case <-timeout.C:
			t.Fatal("caller did not queue a sync")
		}
	}
}

func TestWebhookWaitsForFreshDurableSyncAndBrowserCancellationDoesNotStopIt(t *testing.T) {
	handler, calls := newQueuedSyncTestHandler(t, newRestartTestLog(t))
	browserCtx, cancelBrowser := context.WithCancel(context.Background())
	defer cancelBrowser()
	browserDone := make(chan error, 1)
	go func() {
		browserDone <- handler.SyncCheckoutSession(browserCtx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_queue"})
	}()
	firstCall := nextSyncRetrieve(t, calls)
	webhookDone := make(chan error, 1)
	go func() {
		webhookDone <- handler.RecordCheckoutSessionEvent(context.Background(), RecordCheckoutSessionEventInput{})
	}()
	waitForQueuedSync(t, handler)
	cancelBrowser()
	select {
	case err := <-browserDone:
		if !errors.Is(err, context.Canceled) {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("browser wait did not cancel")
	}
	if firstCall.ctx.Err() != nil {
		t.Fatal("browser cancellation canceled shared retrieval")
	}
	deadline, ok := firstCall.ctx.Deadline()
	if !ok || time.Until(deadline) > checkoutSessionSyncTimeout {
		t.Fatal("shared pass has no bounded deadline")
	}
	firstCall.complete <- syncRetrieveResult{session: queuedSession(stripe.CheckoutSessionPaymentStatusUnpaid, stripe.PaymentIntentStatusProcessing)}
	followup := nextSyncRetrieve(t, calls)
	select {
	case err := <-webhookDone:
		t.Fatalf("webhook acknowledged before fresh fulfillment: %v", err)
	default:
	}
	followup.complete <- syncRetrieveResult{session: queuedSession(stripe.CheckoutSessionPaymentStatusPaid, stripe.PaymentIntentStatusSucceeded)}
	select {
	case err := <-webhookDone:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("webhook did not finish")
	}
}

func TestSyncQueueServiceCancellationStopsRunningAndQueuedPasses(t *testing.T) {
	lifetime, cancel := context.WithCancel(context.Background())
	defer cancel()
	entered := make(chan struct{})
	handler := NewCommandHandler(NewCommandHandlerInput{Context: lifetime, EventLog: &emptyPaymentEventLog{}, CheckoutSessionRepository: &checkoutSessionRepositoryStub{retrieve: func(ctx context.Context, _ string) (*stripe.CheckoutSession, error) {
		close(entered)
		<-ctx.Done()
		return nil, ctx.Err()
	}}})
	first := handler.requestCheckoutSessionSync(SyncCheckoutSessionInput{CheckoutSessionID: "cs_queue"})
	select {
	case <-entered:
	case <-time.After(5 * time.Second):
		t.Fatal("retrieve did not start")
	}
	queued := handler.requestCheckoutSessionSync(SyncCheckoutSessionInput{CheckoutSessionID: "cs_queue"})
	cancel()
	for _, result := range []*future.Future[*SyncCheckoutSessionOutput]{first, queued} {
		if _, err := awaitSyncResult(t, result); !errors.Is(err, context.Canceled) {
			t.Fatalf("err=%v", err)
		}
	}
}

func TestConcurrentSyncRequestsAcrossIdleTransitionsAllComplete(t *testing.T) {
	lifetime, cancel := context.WithCancel(context.Background())
	defer cancel()
	var inFlight, retrieves atomic.Int32
	handler := NewCommandHandler(NewCommandHandlerInput{Context: lifetime, EventLog: &emptyPaymentEventLog{}, CheckoutSessionRepository: &checkoutSessionRepositoryStub{retrieve: func(ctx context.Context, id string) (*stripe.CheckoutSession, error) {
		if current := inFlight.Add(1); current != 1 {
			t.Errorf("same-session concurrent retrievals=%d", current)
		}
		defer inFlight.Add(-1)
		retrieves.Add(1)
		return &stripe.CheckoutSession{ID: id, Status: stripe.CheckoutSessionStatusOpen}, nil
	}}})
	ctx, stop := context.WithTimeout(lifetime, 5*time.Second)
	defer stop()
	// Repeated bursts exercise registration against runner completion and deletion.
	for round := 0; round < 20; round++ {
		finished := make(chan error, 20)
		for caller := 0; caller < 20; caller++ {
			go func() {
				_, err := handler.SyncCheckoutSessionWithResult(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_queue"})
				finished <- err
			}()
		}
		for caller := 0; caller < 20; caller++ {
			select {
			case err := <-finished:
				if err != nil {
					t.Fatal(err)
				}
			case <-ctx.Done():
				t.Fatal("sync request lost during idle transition")
			}
		}
	}
	if retrieves.Load() < 20 || retrieves.Load() > 400 {
		t.Fatalf("retrieves=%d", retrieves.Load())
	}
}
