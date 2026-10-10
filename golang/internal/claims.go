package internal

import (
	"net/http"
	"strings"
	"time"

	"github.com/ansel1/merry"
)

const (
	TokenUseAccess  = "access"
	TokenUseRefresh = "refresh"
)

type Claims struct {
	ID       string `json:"jti,omitempty"`
	Issuer   string `json:"iss,omitempty"`
	Audience string `json:"aud,omitempty"`
	Subject  URN    `json:"sub,omitempty"`
	Expiry   int64  `json:"exp,omitempty"`
	Scope    string `json:"scp,omitempty"`
	TokenUse string `json:"token_use,omitempty"`
}

// EffectiveTokenUse supports tokens issued before token_use was introduced.
// An explicit token_use always takes precedence over the legacy scope.
func (claims *Claims) EffectiveTokenUse() string {
	if claims.TokenUse != "" {
		return claims.TokenUse
	}
	for _, scope := range strings.Fields(claims.Scope) {
		if scope == "refresh_token" {
			return TokenUseRefresh
		}
	}
	return TokenUseAccess
}

func (claims *Claims) Valid() (err error) {
	if use := claims.EffectiveTokenUse(); use != TokenUseAccess && use != TokenUseRefresh {
		return merry.New("invalid token use").WithHTTPCode(http.StatusUnauthorized)
	}
	if claims.Issuer != "beddybytes" {
		err = merry.New("invalid issuer").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	if claims.Audience != "beddybytes" {
		err = merry.New("invalid audience").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	if claims.Expiry < time.Now().Unix() {
		err = merry.New("token has expired").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	return
}
