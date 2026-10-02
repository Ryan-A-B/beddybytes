package accounts

import (
	"crypto/rand"

	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	uuid "github.com/satori/go.uuid"
)

type Account struct {
	ID   string `json:"id"`
	User *User  `json:"user"`
}

type User struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	PasswordSalt []byte `json:"password_salt"`
	PasswordHash []byte `json:"password_hash"`
	Issuer       string `json:"issuer,omitempty"`
	Subject      string `json:"subject,omitempty"`
}

// Legacy password accounts have no explicit issuer/subject in their events.
func (user *User) Identity() (issuer, subject string) {
	if user.Issuer == "" {
		return "beddybytes", user.ID
	}
	return user.Issuer, user.Subject
}

func (user *User) IsPasswordUser() bool { return user.Issuer == "" || user.Issuer == "beddybytes" }

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
