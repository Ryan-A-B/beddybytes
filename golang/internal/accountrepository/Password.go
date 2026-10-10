package accountrepository

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"errors"
	"io"

	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
)

var ErrInvalidPassword = errors.New("invalid password")

type HashedPassword struct {
	Salt []byte
	Hash []byte
}

func NewHashedPassword(plaintext string) HashedPassword {
	salt := make([]byte, 32)
	_, err := io.ReadFull(rand.Reader, salt)
	fatal.OnError(err)
	passwordHash := calculatePasswordHash(plaintext, salt)
	return HashedPassword{
		Salt: salt,
		Hash: passwordHash,
	}
}

func (hashedPassword *HashedPassword) Verify(plaintext string) error {
	actualHash := calculatePasswordHash(plaintext, hashedPassword.Salt)
	if !bytes.Equal(actualHash, hashedPassword.Hash) {
		return ErrInvalidPassword
	}
	return nil
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
