package accounts

import (
	"crypto/rand"
	"encoding/json"
	"fmt"

	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	uuid "github.com/satori/go.uuid"
)

type IdentityType string

const (
	IdentityTypeInternal IdentityType = "internal"
	IdentityTypeExternal IdentityType = "external"
)

type Account struct {
	ID   string `json:"id"`
	User *User  `json:"user"`
}

// User is BeddyBytes' local account identity. A user may authenticate with
// locally managed password credentials or with an external issuer/subject.
// Provider email is account data only; it never identifies or deduplicates a
// user. An external identity is the exact issuer/subject pair.
type User struct {
	ID               string            `json:"id"`
	IdentityType     IdentityType      `json:"identity_type"`
	InternalIdentity *InternalIdentity `json:"internal_identity,omitempty"`
	ExternalIdentity *ExternalIdentity `json:"external_identity,omitempty"`
}

type InternalIdentity struct {
	Email        string `json:"email"`
	PasswordSalt []byte `json:"password_salt"`
	PasswordHash []byte `json:"password_hash"`
}

type ExternalIdentity struct {
	Issuer  string `json:"issuer"`
	Subject string `json:"subject"`
	Email   string `json:"email,omitempty"`
}

// LegacyUser is the released, flattened password identity stored in old events.
// External identities were never released in this format.
type LegacyUser struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	PasswordSalt []byte `json:"password_salt"`
	PasswordHash []byte `json:"password_hash"`
}

func (legacy LegacyUser) User() User {
	return User{
		ID:           legacy.ID,
		IdentityType: IdentityTypeInternal,
		InternalIdentity: &InternalIdentity{
			Email: legacy.Email, PasswordSalt: legacy.PasswordSalt, PasswordHash: legacy.PasswordHash,
		},
	}
}

// Avoid recursively invoking the custom JSON methods.
type userJSON User

func (user User) MarshalJSON() ([]byte, error) {
	if err := user.validate(); err != nil {
		return nil, err
	}
	return json.Marshal(userJSON(user))
}

func (user *User) UnmarshalJSON(data []byte) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	var decoded User
	if _, present := fields["identity_type"]; present {
		var wire userJSON
		if err := json.Unmarshal(data, &wire); err != nil {
			return err
		}
		decoded = User(wire)
	} else {
		if _, present := fields["internal_identity"]; present {
			return fmt.Errorf("internal identity requires identity_type")
		}
		if _, present := fields["external_identity"]; present {
			return fmt.Errorf("external identity requires identity_type")
		}
		var legacy LegacyUser
		if err := json.Unmarshal(data, &legacy); err != nil {
			return err
		}
		decoded = legacy.User()
	}
	if err := decoded.validate(); err != nil {
		return err
	}
	*user = decoded
	return nil
}

func (user User) validate() error {
	if user.ID == "" {
		return fmt.Errorf("user id is required")
	}
	switch user.IdentityType {
	case IdentityTypeInternal:
		if user.InternalIdentity == nil || user.ExternalIdentity != nil {
			return fmt.Errorf("internal user requires only an internal identity")
		}
		identity := user.InternalIdentity
		if identity.Email == "" || len(identity.PasswordSalt) == 0 || len(identity.PasswordHash) == 0 {
			return fmt.Errorf("internal identity requires email and password credentials")
		}
	case IdentityTypeExternal:
		if user.ExternalIdentity == nil || user.InternalIdentity != nil {
			return fmt.Errorf("external user requires only an external identity")
		}
		if user.ExternalIdentity.Issuer == "" || user.ExternalIdentity.Subject == "" {
			return fmt.Errorf("external identity requires issuer and subject")
		}
	default:
		return fmt.Errorf("unknown identity type %q", user.IdentityType)
	}
	return nil
}

func (user *User) IdentityPair() (issuer, subject string) {
	if user.IdentityType == IdentityTypeInternal {
		return "beddybytes", user.ID
	}
	return user.ExternalIdentity.Issuer, user.ExternalIdentity.Subject
}

func (user *User) IsPasswordUser() bool {
	return user.IdentityType == IdentityTypeInternal
}

type NewInternalIdentityUserInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func NewInternalIdentityUser(input *NewInternalIdentityUserInput) (user *User) {
	passwordSalt := make([]byte, 32)
	_, err := rand.Read(passwordSalt)
	fatal.OnError(err)
	passwordHash := calculatePasswordHash(input.Password, passwordSalt)
	user = &User{
		ID:           uuid.NewV4().String(),
		IdentityType: IdentityTypeInternal,
		InternalIdentity: &InternalIdentity{
			Email:        input.Email,
			PasswordSalt: passwordSalt,
			PasswordHash: passwordHash,
		},
	}
	return
}
