package checkoutsessions

import (
	"context"

	"github.com/stripe/stripe-go/v87"
)

type Repository interface {
	Create(ctx context.Context, accountID string) (checkoutSession *stripe.CheckoutSession, err error)
	Retrieve(ctx context.Context, checkoutSessionID string) (checkoutSession *stripe.CheckoutSession, err error)
	ParseNotification(payload []byte, signature string) (notification *Notification, err error)
}

// Notification identifies a Checkout Session to sync. A nil notification means
// the verified event is unrelated to Checkout and can be acknowledged.
type Notification struct {
	CheckoutSessionID string
}
