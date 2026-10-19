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
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
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
	recordCheckoutStarted(t, log, "account-1", "cs_test_1")
	entered := make(chan struct{})
	var retrieves atomic.Int32
	repository := &checkoutSessionRepositoryStub{
		retrieve: func(ctx context.Context, id string) (*stripe.CheckoutSession, error) {
			if retrieves.Add(1) == 1 {
				close(entered)
				<-oldCtx.Done()
				return nil, oldCtx.Err()
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
	// The old handler still has a sync in progress, but the fresh handler
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

func TestRestartAfterPaidSyncDoesNotGrantTwice(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	data, err := json.Marshal(events.StripeCheckoutSessionStartedDetail{
		SessionID: "cs_paid", CheckoutURL: "https://checkout.stripe.com/paid",
		SessionExpiresAt: time.Now().Add(time.Hour).Unix(),
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
	var retrieves, creates int
	repository := &checkoutSessionRepositoryStub{
		retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
			retrieves++
			return &stripe.CheckoutSession{
				ID: id, ClientReferenceID: "account-1",
				Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: stripe.CheckoutSessionPaymentStatusPaid,
			}, nil
		},
		create: func(context.Context, string) (*stripe.CheckoutSession, error) {
			creates++
			return nil, errors.New("unexpected Create for a paid account")
		},
	}
	first := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
	if err := first.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_paid"}); err != nil {
		t.Fatal(err)
	}
	restarted := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
	if err := restarted.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_paid"}); err != nil {
		t.Fatal(err)
	}
	if _, eligible := restarted.eligibleAccounts["account-1"]; eligible {
		t.Error("fresh handler did not rebuild paid account ineligibility")
	}
	output, err := restarted.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
	if !errors.Is(err, ErrAccountIneligible) || output != nil || creates != 0 {
		t.Errorf("paid account checkout after restart: output=%+v err=%v creates=%d", output, err, creates)
	}
	if retrieves != 2 {
		t.Errorf("expected a fresh Retrieve after restart, got %d", retrieves)
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
		t.Fatalf("expected one perpetual grant across restart, got %d", grants)
	}
}

func TestRestartReplaysProvisionalGrantPreservingTrialStart(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	initial := NewCommandHandler(NewCommandHandlerInput{EventLog: log})
	if err := initial.catchup(ctx); err != nil {
		t.Fatal(err)
	}
	trialStart := initial.eligibleAccounts["account-1"].StartUnixSeconds
	grant, err := log.Append(ctx, eventlog.AppendInput{
		Type: events.TypeProvisionalLicenseGranted, AccountID: "account-1",
	})
	if err != nil {
		t.Fatal(err)
	}
	// Only the log is reused. The original handler still has a trial license.
	restarted := NewCommandHandler(NewCommandHandlerInput{EventLog: log})
	if err := restarted.catchup(ctx); err != nil {
		t.Fatal(err)
	}
	license := restarted.eligibleAccounts["account-1"]
	if license == nil || license.Type != models.LicenseTypeProvisional {
		t.Fatalf("expected replayed provisional license, got %+v", license)
	}
	if license.StartUnixSeconds != grant.UnixTimestamp {
		t.Errorf("provisional start=%d, want grant time %d", license.StartUnixSeconds, grant.UnixTimestamp)
	}
	if license.ProvisionalLicense == nil || license.ProvisionalLicense.TrialStartUnixSeconds != trialStart {
		t.Fatalf("original trial start was not preserved: %+v, want %d", license.ProvisionalLicense, trialStart)
	}
}

func TestRestartReplaysProvisionalRevocationRestoringTrialStart(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	initial := NewCommandHandler(NewCommandHandlerInput{EventLog: log})
	if err := initial.catchup(ctx); err != nil {
		t.Fatal(err)
	}
	trialStart := initial.eligibleAccounts["account-1"].StartUnixSeconds
	for _, eventType := range []eventlog.EventType{events.TypeProvisionalLicenseGranted, events.TypeProvisionalLicenseRevoked} {
		if _, err := log.Append(ctx, eventlog.AppendInput{Type: eventType, AccountID: "account-1"}); err != nil {
			t.Fatal(err)
		}
	}
	restarted := NewCommandHandler(NewCommandHandlerInput{EventLog: log})
	if err := restarted.catchup(ctx); err != nil {
		t.Fatal(err)
	}
	license := restarted.eligibleAccounts["account-1"]
	if license == nil || license.Type != models.LicenseTypeTrial || license.StartUnixSeconds != trialStart || license.ProvisionalLicense != nil {
		t.Fatalf("replayed revocation should restore trial starting at %d without provisional metadata, got %+v", trialStart, license)
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

func TestRestartCreatesAgainAfterStartedEventAppendFailure(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	appendError := errors.New("started event not persisted")
	failedLog := &appendFailingPaymentEventLog{EventLog: log, err: appendError}
	var creates int
	repository := &checkoutSessionRepositoryStub{create: func(context.Context, string) (*stripe.CheckoutSession, error) {
		creates++
		id := "cs_orphan"
		if creates > 1 {
			id = "cs_recovered"
		}
		return &stripe.CheckoutSession{ID: id, URL: "https://checkout.stripe.com/" + id, ExpiresAt: time.Now().Add(time.Hour).Unix()}, nil
	}}
	old := NewCommandHandler(NewCommandHandlerInput{EventLog: failedLog, CheckoutSessionRepository: repository})
	output, err := old.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
	if !errors.Is(err, appendError) || output != nil {
		t.Fatalf("failed start: output=%+v err=%v", output, err)
	}
	restarted := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
	output, err = restarted.StartCheckoutSession(ctx, StartCheckoutSessionInput{AccountID: "account-1"})
	if err != nil || output == nil || output.CheckoutSessionID != "cs_recovered" || creates != 2 {
		t.Fatalf("restart: output=%+v err=%v creates=%d", output, err, creates)
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
		if detail.SessionID != "cs_recovered" {
			t.Errorf("persisted unexpected session: %s", detail.SessionID)
		}
		starts++
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
	if starts != 1 {
		t.Fatalf("started events=%d, want 1", starts)
	}
}

func TestRestartAfterOpenSyncRetrievesAgain(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	recordCheckoutStarted(t, log, "account-1", "cs_open")
	var retrieves int
	repository := &checkoutSessionRepositoryStub{retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
		retrieves++
		return &stripe.CheckoutSession{ID: id, Status: stripe.CheckoutSessionStatusOpen}, nil
	}}
	for i := 0; i < 2; i++ {
		handler := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
		if err := handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: "cs_open"}); err != nil {
			t.Fatal(err)
		}
	}
	if retrieves != 2 {
		t.Fatalf("Retrieve calls=%d, want 2", retrieves)
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
	for iterator.Next(ctx) {
		if event := iterator.Event(); event.Type != events.TypeAccountCreatedV2 && event.Type != events.TypeStripeCheckoutSessionStarted {
			t.Errorf("open sync emitted %s", event.Type)
		}
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
}

func TestRestartAfterProvisionalSyncsPreservesTrialDates(t *testing.T) {
	ctx := context.Background()
	log := newRestartTestLog(t)
	recordCheckoutStarted(t, log, "account-1", "cs_restart")
	status := stripe.PaymentIntentStatusProcessing
	var retrieves int
	repository := &checkoutSessionRepositoryStub{retrieve: func(_ context.Context, id string) (*stripe.CheckoutSession, error) {
		retrieves++
		return &stripe.CheckoutSession{ID: id, ClientReferenceID: "account-1", Status: stripe.CheckoutSessionStatusComplete, PaymentStatus: stripe.CheckoutSessionPaymentStatusUnpaid, PaymentIntent: &stripe.PaymentIntent{ID: "pi_restart", Status: status}}, nil
	}}
	handler := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
	if err := handler.catchup(ctx); err != nil {
		t.Fatal(err)
	}
	trialStart := handler.eligibleAccounts["account-1"].StartUnixSeconds
	input := SyncCheckoutSessionInput{CheckoutSessionID: "cs_restart"}
	if err := handler.SyncCheckoutSession(ctx, input); err != nil {
		t.Fatal(err)
	}
	restarted := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
	if err := restarted.catchup(ctx); err != nil {
		t.Fatal(err)
	}
	license := restarted.eligibleAccounts["account-1"]
	if license == nil || license.Type != models.LicenseTypeProvisional || license.ProvisionalLicense == nil || license.ProvisionalLicense.TrialStartUnixSeconds != trialStart {
		t.Fatalf("restarted provisional license lost original trial %d: %+v", trialStart, license)
	}
	if err := restarted.SyncCheckoutSession(ctx, input); err != nil {
		t.Fatal(err)
	}
	status = stripe.PaymentIntentStatusRequiresPaymentMethod
	if err := restarted.SyncCheckoutSession(ctx, input); err != nil {
		t.Fatal(err)
	}
	afterRevocation := NewCommandHandler(NewCommandHandlerInput{EventLog: log, CheckoutSessionRepository: repository})
	if err := afterRevocation.catchup(ctx); err != nil {
		t.Fatal(err)
	}
	license = afterRevocation.eligibleAccounts["account-1"]
	if license == nil || license.Type != models.LicenseTypeTrial || license.StartUnixSeconds != trialStart || license.ProvisionalLicense != nil {
		t.Fatalf("revocation did not restore original trial %d: %+v", trialStart, license)
	}
	if err := afterRevocation.SyncCheckoutSession(ctx, input); err != nil {
		t.Fatal(err)
	}
	if retrieves != 4 {
		t.Fatalf("Retrieve calls=%d, want 4", retrieves)
	}
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
	var grants, revocations int
	for iterator.Next(ctx) {
		switch iterator.Event().Type {
		case events.TypeProvisionalLicenseGranted:
			grants++
		case events.TypeProvisionalLicenseRevoked:
			revocations++
		}
	}
	if err := iterator.Err(); err != nil {
		t.Fatal(err)
	}
	if grants != 1 || revocations != 1 {
		t.Fatalf("grants=%d revocations=%d, want one each", grants, revocations)
	}
}
