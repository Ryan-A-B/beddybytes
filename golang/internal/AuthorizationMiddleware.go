package internal

import (
	"crypto/rsa"
	"log"
	"net/http"
	"strings"

	"github.com/ansel1/merry"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"

	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
)

type AuthorizationMiddleware struct {
	Key interface{}
}

func NewAuthorizationMiddleware(key interface{}) *AuthorizationMiddleware {
	return &AuthorizationMiddleware{
		Key: key,
	}
}

func (middleware *AuthorizationMiddleware) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		var err error
		defer func() {
			if err != nil {
				log.Println("Warn: ", err)
				httpx.Error(responseWriter, err)
				return
			}
		}()
		accessToken, err := middleware.getAccessToken(request)
		if err != nil {
			return
		}
		var claims Claims
		_, err = jwt.ParseWithClaims(accessToken, &claims, middleware.getKey)
		if err != nil {
			err = merry.Prepend(err, "failed to parse access token").WithUserMessage("unauthorized").WithHTTPCode(http.StatusUnauthorized)
			return
		}
		if claims.Subject.Service != "iam" {
			err = merry.New("wrong subject service").WithUserMessage("unauthorized").WithHTTPCode(http.StatusUnauthorized)
			return
		}
		if claims.Subject.ResourceType != "user" {
			err = merry.New("wrong subject resource type").WithUserMessage("unauthorized").WithHTTPCode(http.StatusUnauthorized)
			return
		}
		vars := mux.Vars(request)
		accountID := vars["account_id"]
		if accountID != "" && accountID != "current" && claims.Subject.AccountID != accountID {
			err = merry.New("forbidden").WithHTTPCode(http.StatusForbidden)
			return
		}
		ctx := request.Context()
		ctx = ContextWithAccountID(ctx, claims.Subject.AccountID)
		next.ServeHTTP(responseWriter, request.Clone(ctx))
	})
}

func (middleware *AuthorizationMiddleware) getAccessToken(request *http.Request) (accessToken string, err error) {
	accessToken, ok := middleware.getAccessTokenFromAuthorizationHeader(request)
	if ok {
		return
	}
	accessToken, ok = middleware.getAccessTokenFromFormValues(request)
	if ok {
		return
	}
	err = merry.New("unauthorized").WithHTTPCode(http.StatusUnauthorized)
	return
}

func (middleware *AuthorizationMiddleware) getAccessTokenFromAuthorizationHeader(request *http.Request) (accessToken string, ok bool) {
	const prefix = "Bearer "
	authorization := request.Header.Get("Authorization")
	if !strings.HasPrefix(authorization, prefix) {
		ok = false
		return
	}
	accessToken = authorization[len(prefix):]
	ok = true
	return
}

func (middleware *AuthorizationMiddleware) getAccessTokenFromFormValues(request *http.Request) (accessToken string, ok bool) {
	accessToken = request.FormValue("access_token")
	if accessToken == "" {
		ok = false
		return
	}
	ok = true
	return
}

func (middleware *AuthorizationMiddleware) getKey(token *jwt.Token) (key interface{}, err error) {
	switch v := middleware.Key.(type) {
	case *rsa.PrivateKey:
		key = &v.PublicKey
		return
	default:
		key = middleware.Key
		return
	}
}
