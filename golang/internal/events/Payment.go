package events

import "github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"

const (
	TypeStripeCheckoutSessionEnded     eventlog.EventType = "stripe_checkout_session.ended"
	TypeStripeCheckoutSessionStarted   eventlog.EventType = "stripe_checkout_session.started"
	TypeStripeCheckoutSessionSucceeded eventlog.EventType = "stripe_checkout_session.succeeded"
	TypeStripeCheckoutSessionCancelled eventlog.EventType = "stripe_checkout_session.cancelled"
)

type StripeCheckoutSessionStartedDetail struct {
	SessionID        string `json:"session_id"`
	CheckoutURL      string `json:"checkout_url"`
	SessionExpiresAt int64  `json:"session_expires_at"`
}

type StripeCheckoutSessionSucceededDetail struct {
}

type StripeCheckoutSessionCancelledDetail struct {
}

type StripeCheckoutSessionEndedDetail struct {
	SessionID string `json:"session_id"`
}
