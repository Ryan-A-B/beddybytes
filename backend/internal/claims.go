package internal

import (
	"net/http"
	"time"

	"github.com/ansel1/merry"
)

type Claims struct {
	Issuer   string `json:"iss"`
	Audience string `json:"aud"`
	Subject  URN    `json:"sub"`
	Expiry   int64  `json:"exp"`
	Scope    string `json:"scp"`
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
	if claims.Subject.Service != "iam" {
		return merry.New("invalid subject").WithHTTPCode(http.StatusUnauthorized)
	}
	if claims.Subject.ResourceType != "user" {
		return merry.New("invalid subject").WithHTTPCode(http.StatusUnauthorized)
	}
	if claims.Expiry < time.Now().Unix() {
		err = merry.New("token has expired").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	return
}
