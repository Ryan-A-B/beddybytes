package paymentrepository

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

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

type checkoutSessionRepositoryStub struct {
	retrieve func(context.Context, string) (*stripe.CheckoutSession, error)
}

func (*checkoutSessionRepositoryStub) Create(context.Context, string) (*stripe.CheckoutSession, error) {
	return nil, fmt.Errorf("unexpected Create call")
}

func (stub *checkoutSessionRepositoryStub) Retrieve(ctx context.Context, id string) (*stripe.CheckoutSession, error) {
	return stub.retrieve(ctx, id)
}

func (*checkoutSessionRepositoryStub) ConstructEvent([]byte, string) (*stripe.Event, error) {
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
