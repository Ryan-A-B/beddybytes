package internal

import (
	"net/http"
	"strings"

	"github.com/ansel1/merry"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	"github.com/ryan/baby-monitor/backend/internal/fatal"
)

type AuthorizationMiddleware struct {
	Key []byte
}

func NewAuthorizationMiddleware(key []byte) *AuthorizationMiddleware {
	return &AuthorizationMiddleware{
		Key: key,
	}
}

func (middleware *AuthorizationMiddleware) Middleware(next http.Handler) http.Handler {
	const prefix = "Bearer "
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		var err error
		defer func() {
			if err != nil {
				http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
				return
			}
		}()
		authorization := request.Header.Get("Authorization")
		if !strings.HasPrefix(authorization, prefix) {
			err = merry.New("unauthorized").WithHTTPCode(http.StatusUnauthorized)
			return
		}
		accessToken := authorization[len(prefix):]
		var claims Claims
		_, err = jwt.ParseWithClaims(accessToken, &claims, middleware.getKey)
		fatal.OnError(err)
		if err != nil {
			err = merry.New("unauthorized").WithHTTPCode(http.StatusUnauthorized)
			return
		}
		vars := mux.Vars(request)
		accountID := vars["account_id"]
		if accountID != "" && claims.Subject.AccountID != accountID {
			err = merry.New("forbidden").WithHTTPCode(http.StatusForbidden)
			return
		}
		ctx := request.Context()
		ctx = ContextWithAccountID(ctx, claims.Subject.AccountID)
		next.ServeHTTP(responseWriter, request.Clone(ctx))
	})
}

func (middleware *AuthorizationMiddleware) getKey(token *jwt.Token) (key interface{}, err error) {
	key = middleware.Key
	return
}
