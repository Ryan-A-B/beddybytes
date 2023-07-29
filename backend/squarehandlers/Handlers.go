package squarehandlers

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"time"

	"github.com/ansel1/merry"
	"github.com/gorilla/mux"

	"github.com/Ryan-A-B/baby-monitor/backend/accounts"
	"github.com/Ryan-A-B/baby-monitor/backend/internal"
	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
)

type Handlers struct {
	Key            []byte
	AccountStore   *accounts.AccountStore
	SquarePayments *SquarePayments
	SignatureKey   []byte
}

func (handlers *Handlers) AddRoutes(router *mux.Router) {
	router.Use(internal.LoggingMiddleware)
	router.Use(mux.CORSMethodMiddleware(router))
	router.Use(internal.SkipOptionsMiddleware)
	router.HandleFunc("/square/webhook", handlers.HandleWebhook).Methods(http.MethodPost).Name("HandleWebhook")

	authenticatedRouter := router.NewRoute().Subrouter()
	authenticatedRouter.Use(internal.NewAuthorizationMiddleware(handlers.Key).Middleware)
	authenticatedRouter.HandleFunc("/payment_link_url", handlers.GetPaymentLinkURL).Methods(http.MethodGet, http.MethodOptions).Name("GetPaymentLink")
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
	if account.Subscription.State == accounts.SubscriptionStateActive {
		responseWriter.WriteHeader(http.StatusNoContent)
		return
	}
	paymentLinkURL, err := handlers.SquarePayments.GetPaymentLinkURL(accountID, account.Subscription.State)
	if err != nil {
		return
	}
	responseWriter.Header().Set("Content-Type", "application/json")
	json.NewEncoder(responseWriter).Encode(paymentLinkURL)
}

type EventType string

const (
	EventTypeOrderCreated             EventType = "order.created"
	EventTypeOrderUpdated             EventType = "order.updated"
	EventTypeOrderFullfillmentUpdated EventType = "order.fulfillment.updated"
	EventTypePaymentCreated           EventType = "payment.created"
	EventTypePaymentUpdated           EventType = "payment.updated"
)

type Event struct {
	MerchantID string    `json:"merchant_id"`
	Type       EventType `json:"type"`
	EventID    string    `json:"event_id"`
	CreatedAt  string    `json:"created_at"`
	Data       EventData `json:"data"`
}

type EventData struct {
	Type   string `json:"type"`
	ID     string `json:"id"`
	Object Object `json:"object"`
}

type Object struct {
	Payment *Payment `json:"payment"`
}

type Payment struct {
	ID      string `json:"id"`
	OrderID string `json:"order_id"`
	Status  string `json:"status"`
}

func (handlers *Handlers) HandleWebhook(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			log.Println(err)
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		}
	}()
	ctx := request.Context()
	signature, err := handlers.getSignature(request)
	if err != nil {
		return
	}
	payload, err := handlers.getPayload(request)
	if err != nil {
		return
	}
	requestURL := handlers.getRequestURL(request)
	err = handlers.checkSignature(signature, requestURL, payload)
	if err != nil {
		return
	}
	log.Println("webhook payload: " + string(payload))
	var event Event
	err = json.Unmarshal(payload, &event)
	if err != nil {
		return
	}
	switch event.Type {
	case EventTypePaymentCreated, EventTypePaymentUpdated:
		handlers.handlePaymentEvent(ctx, &event)
	}
}

func (handlers *Handlers) handlePaymentEvent(ctx context.Context, event *Event) {
	if event.Data.Object.Payment.Status != "COMPLETED" {
		return
	}
	accountID, ok := handlers.SquarePayments.accountIDByOrderID[event.Data.Object.Payment.OrderID]
	if !ok {
		log.Println("Error: could not find account id for order id: " + event.Data.Object.Payment.OrderID)
		return
	}
	account, err := handlers.AccountStore.Get(ctx, accountID)
	if err != nil {
		log.Println("Error: could not find account: " + accountID)
		return
	}
	switch account.Subscription.State {
	case accounts.SubscriptionStateTrial:
		account.Subscription = accounts.Subscription{
			State: accounts.SubscriptionStateActive,
			Active: &accounts.SubscriptionActive{
				Expiry: account.Subscription.Trial.Expiry.AddDate(0, 1, 0),
			},
		}
	case accounts.SubscriptionStateActive:
		account.Subscription.Active.Expiry = account.Subscription.Active.Expiry.AddDate(0, 1, 0)
	case accounts.SubscriptionStateCanceled:
		t0 := time.Now()
		if t0.Before(account.Subscription.Canceled.Expiry) {
			t0 = account.Subscription.Canceled.Expiry
		}
		account.Subscription = accounts.Subscription{
			State: accounts.SubscriptionStateActive,
			Active: &accounts.SubscriptionActive{
				Expiry: t0.AddDate(0, 1, 0),
			},
		}
	}
	err = handlers.AccountStore.Put(ctx, account)
	fatal.OnError(err)
}

func (handlers *Handlers) checkSignature(signature []byte, requestURL string, payload []byte) (err error) {
	hash := hmac.New(sha256.New, handlers.SignatureKey)
	_, err = io.WriteString(hash, requestURL)
	fatal.OnError(err)
	_, err = hash.Write(payload)
	fatal.OnError(err)
	sum := hash.Sum(nil)
	if !hmac.Equal(sum, signature) {
		err = merry.New("signature does not match").WithHTTPCode(http.StatusForbidden)
		return
	}
	return
}

func (handlers *Handlers) getSignature(request *http.Request) (signature []byte, err error) {
	signatureBase64 := request.Header.Get("x-square-hmacsha256-signature")
	signature, err = base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil {
		err = merry.Prepend(err, "error decoding signature").WithHTTPCode(http.StatusForbidden)
		return
	}
	if len(signature) != 32 {
		err = merry.New("signature is not 32 bytes long").WithHTTPCode(http.StatusForbidden)
		return
	}
	return
}

func (handlers *Handlers) getPayload(request *http.Request) (payload []byte, err error) {
	payload, err = ioutil.ReadAll(io.LimitReader(request.Body, 4*1012))
	if err != nil {
		err = merry.Prepend(err, "error reading request body").WithHTTPCode(http.StatusBadRequest)
		return
	}
	return
}

func (handlers *Handlers) getRequestURL(request *http.Request) string {
	return "https://" + request.Host + request.URL.String()
}
