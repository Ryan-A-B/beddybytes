package resetpassword

import (
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"

	"github.com/Ryan-A-B/beddybytes/internal/fatal"
)

type Tokens struct {
	items sync.Map
	ttl   time.Duration
}

type NewTokensInput struct {
	TTL time.Duration
}

func NewTokens(input NewTokensInput) *Tokens {
	return &Tokens{
		ttl: input.TTL,
	}
}

func (tokens *Tokens) Create(email string) (token string) {
	token = generateToken()
	tokens.items.Store(token, email)
	time.AfterFunc(tokens.ttl, func() {
		tokens.items.Delete(token)
	})
	return
}

func (tokens *Tokens) Consume(token string, run func(email string)) bool {
	email, ok := tokens.items.Load(token)
	if !ok {
		return false
	}
	run(email.(string))
	tokens.items.Delete(token)
	return true
}

func generateToken() string {
	token := make([]byte, 5)
	_, err := rand.Read(token)
	fatal.OnError(err)
	return hex.EncodeToString(token)
}
