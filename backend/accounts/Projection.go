package accounts

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/Ryan-A-B/baby-monitor/backend/internal/eventlog"
	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
	"github.com/Ryan-A-B/baby-monitor/internal/square"
)

const EventTypeAccountCreated = "account.created"
const EventTypePaymentLinkCreated = "payment_link.created"
const EventTypeSquarePaymentCreated = "square.payment.created"
const EventTypeSquarePaymentUpdated = "square.payment.updated"

func (handlers *Handlers) RunProjection(ctx context.Context) {
	iterator := handlers.EventLog.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
		Cursor: 0,
	})
	for iterator.Next() {
		event := iterator.Event()
		handlers.ApplyEvent(ctx, event)
	}
	fatal.OnError(iterator.Err())
}

func (handlers *Handlers) ApplyEvent(ctx context.Context, event *eventlog.Event) {
	switch event.Type {
	case EventTypeAccountCreated:
		handlers.ApplyAccountCreatedEvent(ctx, event)
	case EventTypePaymentLinkCreated:
		handlers.ApplyPaymentLinkCreatedEvent(ctx, event)
	case EventTypeSquarePaymentCreated, EventTypeSquarePaymentUpdated:
		handlers.ApplySquarePaymentEvent(ctx, event)
	}
}

func (handlers *Handlers) ApplyAccountCreatedEvent(ctx context.Context, event *eventlog.Event) {
	var account Account
	var err error
	err = json.Unmarshal(event.Data, &account)
	fatal.OnError(err)
	err = handlers.AccountStore.Put(ctx, &account)
	fatal.OnError(err)
}

func (handlers *Handlers) ApplyPaymentLinkCreatedEvent(ctx context.Context, event *eventlog.Event) {
	var frame PaymentLinkFrame
	err := json.Unmarshal(event.Data, &frame)
	fatal.OnError(err)
	handlers.AccountIDByOrderID[frame.PaymentLink.OrderID] = frame.AccountID
	handlers.PaymentLinkMutex.Lock()
	defer handlers.PaymentLinkMutex.Unlock()
	handlers.PaymentLinkByAccountID[frame.AccountID] = frame.PaymentLink
}

func (handlers *Handlers) ApplySquarePaymentEvent(ctx context.Context, event *eventlog.Event) {
	var squareEvent square.Event
	err := json.Unmarshal(event.Data, &squareEvent)
	fatal.OnError(err)
	if squareEvent.Data.Object.Payment.Status != "COMPLETED" {
		return
	}
	if _, ok := handlers.AppliedPayments[squareEvent.Data.Object.Payment.ID]; ok {
		return
	}
	accountID, ok := handlers.AccountIDByOrderID[squareEvent.Data.Object.Payment.OrderID]
	if !ok {
		log.Println("Error: could not find account id for order id: " + squareEvent.Data.Object.Payment.OrderID)
		return
	}
	account, err := handlers.AccountStore.Get(ctx, accountID)
	if err != nil {
		log.Println("Error: could not find account: " + accountID)
		return
	}
	switch account.Subscription.State {
	case SubscriptionStateTrial:
		t0 := time.Now()
		if t0.Before(account.Subscription.Trial.Expiry) {
			t0 = account.Subscription.Trial.Expiry
		}
		account.Subscription = Subscription{
			State: SubscriptionStateActive,
			Active: &SubscriptionActive{
				Expiry: t0.AddDate(0, 1, 0),
			},
		}
	case SubscriptionStateActive:
		account.Subscription.Active.Expiry = account.Subscription.Active.Expiry.AddDate(0, 1, 0)
	case SubscriptionStateCanceled:
		t0 := time.Now()
		if t0.Before(account.Subscription.Canceled.Expiry) {
			t0 = account.Subscription.Canceled.Expiry
		}
		account.Subscription = Subscription{
			State: SubscriptionStateActive,
			Active: &SubscriptionActive{
				Expiry: t0.AddDate(0, 1, 0),
			},
		}
	}
	err = handlers.AccountStore.Put(ctx, account)
	fatal.OnError(err)
	handlers.AppliedPayments[squareEvent.Data.Object.Payment.ID] = struct{}{}
}
