package models

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
	Salt   []byte
	Digest []byte
}

func New(plaintext string) HashedPassword {
	salt := make([]byte, 32)
	_, err := io.ReadFull(rand.Reader, salt)
	fatal.OnError(err)
	digest := calculatePasswordHash(plaintext, salt)
	return HashedPassword{
		Salt:   salt,
		Digest: digest,
	}
}

func (hashedPassword *HashedPassword) Verify(plaintext string) error {
	actualHash := calculatePasswordHash(plaintext, hashedPassword.Salt)
	if !bytes.Equal(actualHash, hashedPassword.Digest) {
		return ErrInvalidPassword
	}
	return nil
}

func calculatePasswordHash(password string, salt []byte) (digest []byte) {
	var err error
	hash := sha256.New()
	_, err = hash.Write(salt)
	fatal.OnError(err)
	_, err = io.WriteString(hash, password)
	fatal.OnError(err)
	digest = hash.Sum(nil)
	return
}
