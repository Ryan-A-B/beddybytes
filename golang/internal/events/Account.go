package events

import (
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
)

const (
	TypeAccountCreatedV1     eventlog.EventType = "account.created"
	TypeAccountCreatedV2     eventlog.EventType = "account.created.v2"
	TypeAccountPasswordReset eventlog.EventType = "account.password_reset"

	TypePerpetualLicenseGranted   eventlog.EventType = "account.license.perpetual_granted"
	TypeProvisionalLicenseGranted eventlog.EventType = "account.license.provisional_granted"
	TypeProvisionalLicenseRevoked eventlog.EventType = "account.license.provisional_revoked"
)

type UserV1 struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	PasswordSalt []byte `json:"password_salt"`
	PasswordHash []byte `json:"password_hash"`
}

type AccountCreatedV1Detail struct {
	AccountID string `json:"id"`
	User      UserV1 `json:"user"`
}

type AccountCreatedV2Detail struct {
	AccountID string      `json:"account_id"`
	User      models.User `json:"user"`
}

type AccountPasswordResetDetail struct {
	Email        string `json:"email"`
	PasswordSalt []byte `json:"password_salt"`
	PasswordHash []byte `json:"password_hash"`
}

// LicenseEventDetail identifies the checkout responsible for a payment-driven license change.
type LicenseEventDetail struct {
	StripeCheckoutSessionID string `json:"stripe_checkout_session_id"`
}
