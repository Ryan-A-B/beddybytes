package checkoutsessions

import (
	"context"
	"errors"

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

// ParseNotification verifies the unchanged body before interpreting a thin event.
// We use only its related object ID; all payment state is retrieved from Stripe.
func (repository *StripeRepository) ParseNotification(payload []byte, signature string) (*Notification, error) {
	notification, err := repository.client.ParseEventNotification(payload, signature, repository.webhookSecret)
	if err != nil {
		return nil, err
	}
	var relatedObject stripe.V2CoreEventRelatedObject
	switch notification := notification.(type) {
	case *stripe.V1CheckoutSessionCompletedEventNotification:
		relatedObject = notification.RelatedObject
	case *stripe.V1CheckoutSessionExpiredEventNotification:
		relatedObject = notification.RelatedObject
	case *stripe.V1CheckoutSessionAsyncPaymentSucceededEventNotification:
		relatedObject = notification.RelatedObject
	case *stripe.V1CheckoutSessionAsyncPaymentFailedEventNotification:
		relatedObject = notification.RelatedObject
	default:
		return nil, nil
	}
	if relatedObject.ID == "" || relatedObject.Type != "checkout.session" {
		return nil, errors.New("Checkout Session notification requires a related checkout.session ID")
	}
	return &Notification{CheckoutSessionID: relatedObject.ID}, nil
}
