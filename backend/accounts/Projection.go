package accounts

import (
	"context"
	"encoding/json"

	"github.com/Ryan-A-B/beddybytes/backend/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/internal/fatal"
)

const EventTypeAccountCreated = "account.created"
const EventTypeSquareSubscriptionCreated = "square.subscription.created"
const EventTypeSquareInvoiceCreated = "square.invoice.created"
const EventTypeSquareInvoiceUpdated = "square.invoice.updated"
const EventTypeSquareInvoicePublished = "square.invoice.published"
const EventTypeSquareInvoicePaymentMade = "square.invoice.payment_made"

func (handlers *Handlers) ApplyEvent(ctx context.Context, event *eventlog.Event) {
	switch event.Type {
	case EventTypeAccountCreated:
		handlers.ApplyAccountCreatedEvent(ctx, event)
	}
}

func (handlers *Handlers) ApplyAccountCreatedEvent(ctx context.Context, event *eventlog.Event) {
	var account Account
	err := json.Unmarshal(event.Data, &account)
	fatal.OnError(err)
	err = handlers.AccountStore.Put(ctx, &account)
	fatal.OnError(err)
}
