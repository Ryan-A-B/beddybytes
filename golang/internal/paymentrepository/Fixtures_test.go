package paymentrepository

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
)

// recordCheckoutStarted persists the prerequisite for syncing a backend-created checkout.
func recordCheckoutStarted(t *testing.T, log eventlog.EventLog, accountID, sessionID string) {
	t.Helper()
	data, err := json.Marshal(events.StripeCheckoutSessionStartedDetail{
		SessionID:        sessionID,
		CheckoutURL:      "https://checkout.stripe.com/" + sessionID,
		SessionExpiresAt: time.Now().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := log.Append(context.Background(), eventlog.AppendInput{
		Type: events.TypeStripeCheckoutSessionStarted, AccountID: accountID, Data: data,
	}); err != nil {
		t.Fatal(err)
	}
}
