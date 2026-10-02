package accounts

import (
	"crypto/rand"
	"encoding/json"

	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	uuid "github.com/satori/go.uuid"
)

type Account struct {
	ID   string `json:"id"`
	User *User  `json:"user"`
}

// User is BeddyBytes' local account identity. A user may authenticate with
// locally managed password credentials or with an external issuer/subject.
// Provider email is account data only; it never identifies or deduplicates a
// user. ExternalIdentity identity is the exact issuer/subject pair.
type User struct {
	ID                  string               `json:"id"`
	PasswordCredentials *PasswordCredentials `json:"-"`
	Identity            *ExternalIdentity    `json:"-"`
}

type PasswordCredentials struct {
	Email        string `json:"email"`
	PasswordSalt []byte `json:"password_salt"`
	PasswordHash []byte `json:"password_hash"`
}

type ExternalIdentity struct {
	Issuer  string `json:"issuer"`
	Subject string `json:"subject"`
	Email   string `json:"email,omitempty"`
}

// userJSON retains the existing account API and event shape for legacy
// password accounts while allowing external identities to omit password data.
type userJSON struct {
	ID           string `json:"id"`
	Email        string `json:"email,omitempty"`
	PasswordSalt []byte `json:"password_salt,omitempty"`
	PasswordHash []byte `json:"password_hash,omitempty"`
	Issuer       string `json:"issuer,omitempty"`
	Subject      string `json:"subject,omitempty"`
}

func (user User) MarshalJSON() ([]byte, error) {
	wire := userJSON{ID: user.ID}
	if user.PasswordCredentials != nil {
		wire.Email = user.PasswordCredentials.Email
		wire.PasswordSalt = user.PasswordCredentials.PasswordSalt
		wire.PasswordHash = user.PasswordCredentials.PasswordHash
	}
	if user.Identity != nil {
		wire.Email = user.Identity.Email
		wire.Issuer = user.Identity.Issuer
		wire.Subject = user.Identity.Subject
	}
	return json.Marshal(wire)
}

func (user *User) UnmarshalJSON(data []byte) error {
	var wire userJSON
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}
	user.ID = wire.ID
	user.PasswordCredentials = nil
	user.Identity = nil
	if wire.Issuer != "" {
		user.Identity = &ExternalIdentity{Issuer: wire.Issuer, Subject: wire.Subject, Email: wire.Email}
		// Older provider events had flattened fields; retain email as account
		// data while keeping it out of the identity key and password credentials.
		return nil
	}
	user.PasswordCredentials = &PasswordCredentials{Email: wire.Email, PasswordSalt: wire.PasswordSalt, PasswordHash: wire.PasswordHash}
	return nil
}

// Legacy password accounts have no explicit issuer/subject in their events.
func (user *User) IdentityPair() (issuer, subject string) {
	if user.Identity == nil || user.Identity.Issuer == "" {
		return "beddybytes", user.ID
	}
	return user.Identity.Issuer, user.Identity.Subject
}

func (user *User) IsPasswordUser() bool {
	return user.PasswordCredentials != nil && (user.Identity == nil || user.Identity.Issuer == "beddybytes")
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
		ID: uuid.NewV4().String(),
		PasswordCredentials: &PasswordCredentials{
			Email: input.Email, PasswordSalt: passwordSalt, PasswordHash: passwordHash,
		},
	}
	return
}
