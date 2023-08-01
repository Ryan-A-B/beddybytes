package accounts

import (
	"crypto/rand"
	"time"

	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
	uuid "github.com/satori/go.uuid"
)

type Account struct {
	ID           string       `json:"id"`
	Subscription Subscription `json:"subscription"`
	User         *User        `json:"user"`
}

type SubscriptionState string

const (
	SubscriptionStateTrial    SubscriptionState = "trial"
	SubscriptionStateActive   SubscriptionState = "active"
	SubscriptionStateCanceled SubscriptionState = "canceled"
)

type Subscription struct {
	State    SubscriptionState     `json:"state"`
	Trial    *SubscriptionTrial    `json:"trial,omitempty"`
	Active   *SubscriptionActive   `json:"active,omitempty"`
	Canceled *SubscriptionCanceled `json:"canceled,omitempty"`
}

type SubscriptionTrial struct {
	Expiry time.Time `json:"expiry"`
}

type SubscriptionActive struct {
	ManagementURL string    `json:"management_url"`
	Expiry        time.Time `json:"expiry"`
}

type SubscriptionCanceled struct {
	Expiry time.Time `json:"expiry"`
}

type User struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	PasswordSalt []byte `json:"password_salt"`
	PasswordHash []byte `json:"password_hash"`
}

type NewUserInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func NewUser(input *NewUserInput) (user *User) {
	passwordSalt := make([]byte, 32)
	_, err := rand.Read(passwordSalt)
	fatal.OnError(err)
	passwordHash := calculatePasswordHash(input.Password, passwordSalt)
	user = &User{
		ID:           uuid.NewV4().String(),
		Email:        input.Email,
		PasswordSalt: passwordSalt,
		PasswordHash: passwordHash,
	}
	return
}
