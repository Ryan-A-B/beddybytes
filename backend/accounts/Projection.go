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
const EventTypeSquareSubscriptionCreated = "square.subscription.created"
const EventTypeSquareInvoiceCreated = "square.invoice.created"
const EventTypeSquareInvoiceUpdated = "square.invoice.updated"
const EventTypeSquareInvoicePublished = "square.invoice.published"
const EventTypeSquareInvoicePaymentMade = "square.invoice.payment_made"

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
	case EventTypeSquareSubscriptionCreated:
		handlers.ApplySquareSubscriptionCreatedEvent(ctx, event)
	case EventTypeSquareInvoiceCreated, EventTypeSquareInvoiceUpdated, EventTypeSquareInvoicePublished, EventTypeSquareInvoicePaymentMade:
		handlers.ApplySquareInvoiceEvent(ctx, event)
	}
}

func (handlers *Handlers) ApplyAccountCreatedEvent(ctx context.Context, event *eventlog.Event) {
	var account Account
	err := json.Unmarshal(event.Data, &account)
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

func (handlers *Handlers) ApplySquareSubscriptionCreatedEvent(ctx context.Context, event *eventlog.Event) {
	var squareEvent square.Event
	err := json.Unmarshal(event.Data, &squareEvent)
	fatal.OnError(err)
	orderID := squareEvent.Data.Object.Subscription.OrderTemplateID
	accountID, ok := handlers.AccountIDByOrderID[orderID]
	if !ok {
		log.Println("Error: no account found for order ID", orderID)
		return
	}
	handlers.AccountIDBySubscriptionID[squareEvent.Data.Object.Subscription.ID] = accountID
	handlers.SquareSubscriptionByID[squareEvent.Data.Object.Subscription.ID] = squareEvent.Data.Object.Subscription
}

func (handlers *Handlers) ApplySquareInvoiceEvent(ctx context.Context, event *eventlog.Event) {
	var squareEvent square.Event
	err := json.Unmarshal(event.Data, &squareEvent)
	fatal.OnError(err)
	if squareEvent.Data.Object.Invoice.Status != square.InvoiceStatusPaid {
		return
	}
	if _, ok := handlers.AppliedInvoiceIDs[squareEvent.Data.Object.Invoice.ID]; ok {
		return
	}
	accountID, ok := handlers.AccountIDBySubscriptionID[squareEvent.Data.Object.Invoice.SubscriptionID]
	if !ok {
		log.Println("Error: no account found for subscription ID", squareEvent.Data.Object.Invoice.SubscriptionID)
		return
	}
	account, err := handlers.AccountStore.Get(ctx, accountID)
	if err != nil {
		log.Println("Error: failed to get account", err)
		return
	}
	switch account.Subscription.State {
	case SubscriptionStateTrial:
		t0 := time.Now()
		if t0.Before(account.Subscription.Trial.Expiry) {
			t0 = account.Subscription.Trial.Expiry
		}
		squareSubscription, ok := handlers.SquareSubscriptionByID[squareEvent.Data.Object.Invoice.SubscriptionID]
		if !ok {
			log.Println("Error: no square subscription found for subscription ID", squareEvent.Data.Object.Invoice.SubscriptionID)
			return
		}
		account.Subscription = Subscription{
			State: SubscriptionStateActive,
			Active: &SubscriptionActive{
				ManagementURL: squareSubscription.GetSelfManagementURL(),
				Expiry:        t0.AddDate(0, 1, 0),
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
	handlers.AppliedInvoiceIDs[squareEvent.Data.Object.Invoice.ID] = struct{}{}
}
