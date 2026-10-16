package checkoutsessions

import (
	"context"

	"github.com/stripe/stripe-go/v87"
)

type Repository interface {
	Create(ctx context.Context, accountID string) (checkoutSession *stripe.CheckoutSession, err error)
	Retrieve(ctx context.Context, checkoutSessionID string) (checkoutSession *stripe.CheckoutSession, err error)
	ConstructEvent(payload []byte, signature string) (event *stripe.Event, err error)
}
