package events

import "github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"

const (
	TypeStripeCheckoutSessionStarted eventlog.EventType = "stripe_checkout_session.started"
	TypeStripeCheckoutSessionEnded   eventlog.EventType = "stripe_checkout_session.ended"
)

type StripeCheckoutSessionStartedDetail struct {
	SessionID        string `json:"session_id"`
	CheckoutURL      string `json:"checkout_url"`
	SessionExpiresAt int64  `json:"session_expires_at"`
}

type StripeCheckoutSessionEndedDetail struct {
	SessionID string `json:"session_id"`
}
