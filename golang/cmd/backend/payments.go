package main

import (
	"strings"

	"github.com/gorilla/mux"
	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/paymentrepository"
	"github.com/Ryan-A-B/beddybytes/golang/internal/payments"
)

func addPaymentRoutes(router *mux.Router, eventLog eventlog.EventLog, key interface{}) {
	apiOrigin := strings.TrimRight(internal.EnvStringOrFatal("API_ORIGIN"), "/")
	secretKey := internal.EnvStringOrFatal("STRIPE_SECRET_KEY")
	commandHandler := paymentrepository.NewStripeCommandHandler(paymentrepository.NewStripeCommandHandlerInput{
		EventLog:      eventLog,
		Client:        stripe.NewClient(secretKey),
		WebhookSecret: internal.EnvStringOrFatal("STRIPE_WEBHOOK_SECRET"),
		PriceID:       internal.EnvStringOrFatal("STRIPE_PERPETUAL_PRICE_ID"),
		SuccessURL:    apiOrigin + "/payments/stripe/success?session_id={CHECKOUT_SESSION_ID}",
		CancelURL:     apiOrigin + "/payments/stripe/cancel",
	})
	handlers := payments.Handlers{
		Commands:    commandHandler,
		Key:         key,
		FrontendURL: internal.EnvStringOrFatal("FRONTEND_PAYMENT_CALLBACK_URL"),
	}
	handlers.AddRoutes(router)
}
