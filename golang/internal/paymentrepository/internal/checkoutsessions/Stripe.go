package checkoutsessions

import (
	"context"

	"github.com/stripe/stripe-go/v87"
)

type StripeRepository struct {
	client        *stripe.Client
	webhookSecret string
	priceID       string
	successURL    string
	cancelURL     string
}

type NewStripeRepositoryInput struct {
	Client        *stripe.Client
	WebhookSecret string
	PriceID       string
	SuccessURL    string
	CancelURL     string
}

func NewStripeRepository(input NewStripeRepositoryInput) *StripeRepository {
	return &StripeRepository{
		client:        input.Client,
		webhookSecret: input.WebhookSecret,
		priceID:       input.PriceID,
		successURL:    input.SuccessURL,
		cancelURL:     input.CancelURL,
	}
}

func (repository *StripeRepository) Create(ctx context.Context, accountID string) (checkoutSession *stripe.CheckoutSession, err error) {
	return repository.client.V1CheckoutSessions.Create(ctx, &stripe.CheckoutSessionCreateParams{
		Mode:              stripe.String("payment"),
		ClientReferenceID: stripe.String(accountID),
		LineItems: []*stripe.CheckoutSessionCreateLineItemParams{
			{
				Price:    stripe.String(repository.priceID),
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(repository.successURL),
		CancelURL:  stripe.String(repository.cancelURL),
	})
}

func (repository *StripeRepository) Retrieve(ctx context.Context, sessionID string) (checkoutSession *stripe.CheckoutSession, err error) {
	params := &stripe.CheckoutSessionRetrieveParams{}
	params.AddExpand("payment_intent")
	return repository.client.V1CheckoutSessions.Retrieve(ctx, sessionID, params)
}

func (repository *StripeRepository) ConstructEvent(payload []byte, signature string) (event stripe.Event, err error) {
	return stripe.ConstructEvent(payload, signature, repository.webhookSecret)
}
