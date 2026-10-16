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

func TestRestartReusesPersistedCheckout(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	var creates int
	repository := &checkoutSessionRepositoryStub{
		create: func(context.Context, string) (*stripe.CheckoutSession, error) {
			creates++
			return &stripe.CheckoutSession{
				ID: "cs_persisted", URL: "https://checkout.stripe.com/persisted",
				ExpiresAt: time.Now().Add(time.Hour).Unix(),
			}, nil
		},
	}
	first := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
	want, err := first.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
	if err != nil {
		t.Fatal(err)
	}
	// No state is copied from the old handler. Only the log survives.
	restarted := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
	got, err := restarted.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || *got != *want || creates != 1 {
		t.Fatalf("restart returned %+v, want %+v with one Create; creates=%d", got, want, creates)
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
		t.Fatalf("expected one persisted checkout start, got %d", starts)
	}
}

func TestRestartStartsNewCreateWhenOldCreateWasNotPersisted(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	oldCtx, stopOld := context.WithCancel(ctx)
	defer stopOld()
	log := newRestartTestLog(t)
	entered := make(chan struct{})
	var creates atomic.Int32
	repository := &checkoutSessionRepositoryStub{
		create: func(ctx context.Context, _ string) (*stripe.CheckoutSession, error) {
			if creates.Add(1) == 1 {
				close(entered)
				<-ctx.Done()
				return nil, ctx.Err()
			}
			return &stripe.CheckoutSession{
				ID: "cs_after_restart", URL: "https://checkout.stripe.com/after-restart",
				ExpiresAt: time.Now().Add(time.Hour).Unix(),
			}, nil
		},
	}
	old := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
	oldDone := make(chan error, 1)
	go func() {
		_, err := old.StartCheckoutSession(oldCtx, StartCheckoutSessionInput{AccountID: "account-1"})
		oldDone <- err
	}()
	select {
	case <-entered:
	case <-ctx.Done():
		t.Fatal("old handler never reached Create")
	}
	// Hold the old process's future unresolved while bringing up a fresh one.
	// No started event exists, so the new handler must not wait on that future.
	restarted := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
	newDone := make(chan error, 1)
	go func() {
		output, err := restarted.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
		if err == nil && (output == nil || output.CheckoutSessionID != "cs_after_restart") {
			err = errors.New("fresh handler did not return its new checkout")
		}
		newDone <- err
	}()
	select {
	case err := <-newDone:
		if err != nil {
			t.Fatal(err)
		}
	case <-ctx.Done():
		t.Fatal("fresh handler blocked on an old in-memory future")
	}
	stopOld()
	select {
	case err := <-oldDone:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("old create returned %v, want cancellation", err)
		}
	case <-ctx.Done():
		t.Fatal("old Create did not stop")
	}
	if got := creates.Load(); got != 2 {
		t.Fatalf("expected a new Create after restart, got %d total", got)
	}
}

func TestRestartStartsNewSyncWhenOldSyncIsInFlight(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	oldCtx, stopOld := context.WithCancel(ctx)
	defer stopOld()
	log := newRestartTestLog(t)
	entered := make(chan struct{})
	var retrieves atomic.Int32
	repository := &checkoutSessionRepositoryStub{
		retrieve: func(ctx context.Context, id string) (*stripe.CheckoutSession, error) {
			if retrieves.Add(1) == 1 {
				close(entered)
				<-ctx.Done()
				return nil, ctx.Err()
			}
			return &stripe.CheckoutSession{ID: id, ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusOpen}, nil
		},
	}
	old := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
	oldDone := make(chan error, 1)
	go func() {
		oldDone <- old.SyncCheckoutSession(oldCtx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_test_1"})
	}()
	select {
	case <-entered:
	case <-ctx.Done():
		t.Fatal("old handler never reached Retrieve")
	}
	// The old handler still has syncInProgress set, but the fresh handler
	// shares only its durable log and must perform another retrieval.
	restarted := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
	newDone := make(chan error, 1)
	go func() {
		newDone <- restarted.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_test_1"})
	}()
	select {
	case err := <-newDone:
		if err != nil {
			t.Fatal(err)
		}
	case <-ctx.Done():
		t.Fatal("fresh handler blocked on old sync state")
	}
	stopOld()
	select {
	case err := <-oldDone:
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("old sync returned %v, want cancellation", err)
		}
	case <-ctx.Done():
		t.Fatal("old Retrieve did not stop")
	}
	if got := retrieves.Load(); got != 2 {
		t.Fatalf("expected a new Retrieve after restart, got %d total", got)
	}
}

func newRestartTestLog(t *testing.T) *eventlog.FileEventLog {
	t.Helper()
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: t.TempDir()})
	if _, err := log.Append(context.Background(), eventlog.AppendInput{
		Type: events.TypeAccountCreatedV2, Data: json.RawMessage(`{"account_id":"account-1"}`),
	}); err != nil {
		t.Fatal(err)
	}
	return log
}
