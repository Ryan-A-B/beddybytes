package main

import (
	"net/http"
	"os"
	"strings"

	"github.com/gorilla/mux"
	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/paymentrepository"
	"github.com/Ryan-A-B/beddybytes/golang/internal/payments"
)

func addPaymentRoutes(router *mux.Router, eventLog eventlog.EventLog, key interface{}) {
	secretKey := os.Getenv("STRIPE_SECRET_KEY")
	if secretKey == "" {
		router.PathPrefix("/payment/").HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
			http.Error(responseWriter, "payments are temporarily unavailable", http.StatusServiceUnavailable)
		})
		return
	}
	apiOrigin := strings.TrimRight(internal.EnvStringOrFatal("API_ORIGIN"), "/")
	commandHandler := paymentrepository.NewStripeCommandHandler(paymentrepository.NewStripeCommandHandlerInput{
		EventLog: eventLog, Client: stripe.NewClient(secretKey),
		WebhookSecret: internal.EnvStringOrFatal("STRIPE_WEBHOOK_SECRET"),
		PriceID:       internal.EnvStringOrFatal("STRIPE_PERPETUAL_PRICE_ID"),
		SuccessURL:    apiOrigin + "/payment/stripe/success?session_id={CHECKOUT_SESSION_ID}",
		CancelURL:     apiOrigin + "/payment/stripe/cancel",
	})
	handlers := payments.Handlers{
		Commands: commandHandler, Key: key, FrontendURL: internal.EnvStringOrFatal("FRONTEND_PAYMENT_CALLBACK_URL"),
	}
	handlers.AddRoutes(router)
}
