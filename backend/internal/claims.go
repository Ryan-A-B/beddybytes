package internal

import (
	"net/http"
	"time"

	"github.com/ansel1/merry"
)

type Claims struct {
	ID       string `json:"jti,omitempty"`
	Issuer   string `json:"iss,omitempty"`
	Audience string `json:"aud,omitempty"`
	Subject  URN    `json:"sub,omitempty"`
	Expiry   int64  `json:"exp,omitempty"`
	Scope    string `json:"scp,omitempty"`
}

func (claims *Claims) Valid() (err error) {
	if claims.Issuer != "baby-monitor" {
		err = merry.New("invalid issuer").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	if claims.Audience != "baby-monitor" {
		err = merry.New("invalid audience").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	if claims.Expiry < time.Now().Unix() {
		err = merry.New("token has expired").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	return
}
