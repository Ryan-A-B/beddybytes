package paymentrepository

import (
	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/paymentrepository/internal/checkoutsessions"
)

// NewStripeCommandHandlerInput supplies the Stripe configuration at startup.
type NewStripeCommandHandlerInput struct {
	EventLog      eventlog.EventLog
	Client        *stripe.Client
	WebhookSecret string
	PriceID       string
	SuccessURL    string
	CancelURL     string
}

func NewStripeCommandHandler(input NewStripeCommandHandlerInput) *CommandHandler {
	return NewCommandHandler(NewCommandHandlerInput{
		EventLog: input.EventLog,
		CheckoutSessionRepository: checkoutsessions.NewStripeRepository(checkoutsessions.NewStripeRepositoryInput{
			Client: input.Client, WebhookSecret: input.WebhookSecret, PriceID: input.PriceID,
			SuccessURL: input.SuccessURL, CancelURL: input.CancelURL,
		}),
	})
}
