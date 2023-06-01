package accounts

import (
	"crypto/sha256"
	"io"

	"github.com/ryan/baby-monitor/backend/internal/fatal"
)

type Account struct {
	ID   string `json:"id"`
	User User   `json:"user"`
}

type User struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	PasswordSalt []byte `json:"password_salt"`
	PasswordHash []byte `json:"password_hash"`
}

type AccountStore interface {
	Put(account *Account) (err error)
	Get(accountID string) (account *Account, err error)
	GetByEmail(email string) (account *Account, err error)
	Remove(accountID string) (err error)
}

func calculatePasswordHash(password string, salt []byte) (passwordHash []byte) {
	var err error
	hash := sha256.New()
	_, err = hash.Write(salt)
	fatal.OnError(err)
	_, err = io.WriteString(hash, password)
	fatal.OnError(err)
	passwordHash = hash.Sum(nil)
	return
}
