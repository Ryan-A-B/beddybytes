package accounts

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/ansel1/merry"
	uuid "github.com/satori/go.uuid"

	"github.com/Ryan-A-B/baby-monitor/backend/internal"
	"github.com/Ryan-A-B/baby-monitor/backend/internal/eventlog"
	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
	"github.com/Ryan-A-B/baby-monitor/internal/square"
)

type PaymentLinkFrame struct {
	AccountID   string
	PaymentLink *square.PaymentLink
}

func (handlers *Handlers) GetPaymentLinkURL(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			log.Println("Warn:", err)
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		}
	}()
	ctx := request.Context()
	accountID := internal.GetAccountIDFromContext(ctx)
	account, err := handlers.AccountStore.Get(ctx, accountID)
	if err != nil {
		return
	}
	if account.Subscription.State == SubscriptionStateActive {
		responseWriter.WriteHeader(http.StatusNoContent)
		return
	}
	// TODO this is an expensive lock...
	handlers.PaymentLinkMutex.Lock()
	defer handlers.PaymentLinkMutex.Unlock()
	if paymentLink, ok := handlers.PaymentLinkByAccountID[accountID]; ok {
		responseWriter.Header().Set("Content-Type", "application/json")
		json.NewEncoder(responseWriter).Encode(paymentLink.URL)
		return
	}
	output, err := handlers.Client.CreatePaymentLink(&square.CreatePaymentLinkInput{
		IdempotencyKey: uuid.NewV4().String(),
		CheckoutOptions: &square.CheckoutOptions{
			SubscriptionPlanID: handlers.SubscriptionPlanID,
		},
		QuickPay: &square.QuickPay{
			LocationID: handlers.LocationID,
			Name:       "Baby Monitor Subscription",
			Price: square.Money{
				Amount:   500,
				Currency: square.AUD,
			},
		},
	})
	if err != nil {
		err = merry.WithHTTPCode(err, 500)
		return
	}
	paymentLink := output.PaymentLink
	data, err := json.Marshal(&PaymentLinkFrame{
		AccountID:   accountID,
		PaymentLink: paymentLink,
	})
	fatal.OnError(err)
	_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
		Type: EventTypePaymentLinkCreated,
		Data: data,
	})
	fatal.OnError(err)
	responseWriter.Header().Set("Content-Type", "application/json")
	json.NewEncoder(responseWriter).Encode(paymentLink.URL)
}
