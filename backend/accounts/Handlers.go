package accounts

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/ansel1/merry"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	uuid "github.com/satori/go.uuid"

	"github.com/ryan/baby-monitor/backend/internal"
	"github.com/ryan/baby-monitor/backend/internal/fatal"
)

type Handlers struct {
	FrontendURL          *url.URL
	AccountStore         *AccountStore
	SigningMethod        jwt.SigningMethod
	Key                  interface{}
	AccessTokenDuration  time.Duration
	RefreshTokenDuration time.Duration
	UsedRefreshTokens    UsedRefreshTokens
}

type UsedRefreshTokens struct {
	mutex sync.Mutex
	cache map[string]struct{}
}

func NewUsedRefreshTokens() UsedRefreshTokens {
	return UsedRefreshTokens{
		cache: make(map[string]struct{}),
	}
}

func (usedRefreshTokens *UsedRefreshTokens) TryAdd(refreshToken string) bool {
	usedRefreshTokens.mutex.Lock()
	defer usedRefreshTokens.mutex.Unlock()
	_, ok := usedRefreshTokens.cache[refreshToken]
	if ok {
		return false
	}
	usedRefreshTokens.cache[refreshToken] = struct{}{}
	return true
}

type CreateAccountInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (input *CreateAccountInput) Validate() (err error) {
	if input.Email == "" {
		err = merry.New("email is required").WithHTTPCode(http.StatusBadRequest)
		return
	}
	if len(input.Password) < 20 {
		err = merry.New("password is too short").WithHTTPCode(http.StatusBadRequest)
		return
	}
	return
}

func (handlers *Handlers) CreateAccount(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		}
	}()
	ctx := request.Context()
	var input CreateAccountInput
	err = json.NewDecoder(request.Body).Decode(&input)
	if err != nil {
		return
	}
	err = input.Validate()
	if err != nil {
		return
	}
	passwordSalt := make([]byte, 32)
	_, err = rand.Read(passwordSalt)
	if err != nil {
		return
	}
	passwordHash := calculatePasswordHash(input.Password, passwordSalt)
	account := Account{
		ID: uuid.NewV4().String(),
		User: User{
			ID:           uuid.NewV4().String(),
			Email:        input.Email,
			PasswordSalt: passwordSalt,
			PasswordHash: passwordHash,
		},
	}
	err = handlers.AccountStore.Put(ctx, &account)
	if err != nil {
		return
	}
	responseWriter.Header().Set("Content-Type", "application/json")
	json.NewEncoder(responseWriter).Encode(account)
}

type LoginOutput struct {
	TokenType   string `json:"token_type"`
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
}

func (handlers *Handlers) Token(responseWriter http.ResponseWriter, request *http.Request) {
	// Note: uses concepts from https://tools.ietf.org/html/rfc6749 but is not an OAuth 2.0 implementation
	var err error
	defer func() {
		if err != nil {
			log.Println(err)
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
			return
		}
	}()
	grantType := request.FormValue("grant_type")
	switch grantType {
	case "password":
		handlers.TokenUsingPasswordGrant(responseWriter, request)
	case "refresh_token":
		handlers.TokenUsingRefreshTokenGrant(responseWriter, request)
	default:
		err = merry.New("invalid grant type").WithHTTPCode(http.StatusBadRequest)
		return
	}
}

func (handlers *Handlers) TokenUsingPasswordGrant(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
			return
		}
	}()
	ctx := request.Context()
	email := request.FormValue("username")
	if email == "" {
		err = merry.New("email is required").WithHTTPCode(http.StatusBadRequest)
		return
	}
	password := request.FormValue("password")
	if password == "" {
		err = merry.New("password is required").WithHTTPCode(http.StatusBadRequest)
		return
	}
	account, err := handlers.AccountStore.GetByEmail(ctx, email)
	if err != nil {
		err = merry.New("unauthorized").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	passwordHash := calculatePasswordHash(password, account.User.PasswordSalt)
	if !bytes.Equal(passwordHash, account.User.PasswordHash) {
		err = merry.New("unauthorized").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	output := LoginOutput{
		TokenType:   "Bearer",
		AccessToken: handlers.createAccessToken(account),
		ExpiresIn:   int(handlers.AccessTokenDuration.Seconds()),
	}
	http.SetCookie(responseWriter, handlers.createRefreshTokenCookie(account))
	responseWriter.Header().Set("Content-Type", "application/json")
	json.NewEncoder(responseWriter).Encode(output)
}

func (handlers *Handlers) TokenUsingRefreshTokenGrant(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
			return
		}
	}()
	ctx := request.Context()
	cookie, err := request.Cookie("refresh_token")
	if err != nil {
		log.Println(err)
		err = merry.New("unauthorized").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	refreshToken := cookie.Value
	var claims internal.Claims
	_, err = jwt.ParseWithClaims(refreshToken, &claims, handlers.getKey)
	if err != nil {
		log.Println(err)
		err = merry.New("unauthorized").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	if claims.Scope != "refresh_token" {
		log.Println(`claims.Scope != "refresh_token"`)
		err = merry.New("unauthorized").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	if added := handlers.UsedRefreshTokens.TryAdd(refreshToken); !added {
		log.Println("refresh token has already been used")
		err = merry.New("unauthorized").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	account, err := handlers.AccountStore.Get(ctx, claims.Subject.AccountID)
	if err != nil {
		log.Println(err)
		err = merry.New("unauthorized").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	output := LoginOutput{
		TokenType:   "Bearer",
		AccessToken: handlers.createAccessToken(account),
		ExpiresIn:   int(handlers.AccessTokenDuration.Seconds()),
	}
	http.SetCookie(responseWriter, handlers.createRefreshTokenCookie(account))
	responseWriter.Header().Set("Content-Type", "application/json")
	json.NewEncoder(responseWriter).Encode(output)
}

func (handlers *Handlers) Logout(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
			return
		}
	}()
	cookie, err := request.Cookie("refresh_token")
	switch err {
	case nil:
		cookie.MaxAge = -1
		http.SetCookie(responseWriter, cookie)
		return
	case http.ErrNoCookie:
		err = nil
		return
	default:
		fatal.OnError(err)
	}
}

func (handlers *Handlers) GetAccount(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
			return
		}
	}()
	ctx := request.Context()
	accountID := internal.GetAccountIDFromContext(ctx)
	account, err := handlers.AccountStore.Get(ctx, accountID)
	if err != nil {
		return
	}
	json.NewEncoder(responseWriter).Encode(account)
}

func (handlers *Handlers) DeleteAccount(responseWriter http.ResponseWriter, request *http.Request) {
	ctx := request.Context()
	accountID := internal.GetAccountIDFromContext(ctx)
	err := handlers.AccountStore.Remove(ctx, accountID)
	if err != nil {
		http.Error(responseWriter, err.Error(), http.StatusInternalServerError)
		return
	}
}

func (handlers *Handlers) AddRoutes(router *mux.Router) {
	router.Use(internal.LoggingMiddleware)
	router.Use(mux.CORSMethodMiddleware(router))
	router.Use(internal.CORSMiddleware(handlers.FrontendURL.String()))
	router.HandleFunc("/token", handlers.Token).Methods(http.MethodPost, http.MethodOptions).Name("Token")
	router.HandleFunc("/accounts", handlers.CreateAccount).Methods(http.MethodPost, http.MethodOptions).Name("CreateAccount")

	authenticatedRouter := router.PathPrefix("/accounts/{account_id}").Subrouter()
	authenticatedRouter.Use(internal.NewAuthorizationMiddleware(handlers.Key).Middleware)
	authenticatedRouter.HandleFunc("", handlers.GetAccount).Methods(http.MethodGet, http.MethodOptions).Name("GetAccount")
	authenticatedRouter.HandleFunc("", handlers.DeleteAccount).Methods(http.MethodDelete, http.MethodOptions).Name("DeleteAccount")
}

func (handlers *Handlers) createAccessToken(account *Account) (accessToken string) {
	expiry := time.Now().Add(handlers.AccessTokenDuration)
	claims := internal.Claims{
		Issuer:   "baby-monitor",
		Audience: "baby-monitor",
		Subject: internal.URN{
			Service:      "iam",
			Region:       "",
			AccountID:    account.ID,
			ResourceType: "user",
			ResourceID:   account.User.ID,
		},
		Expiry: expiry.Unix(),
	}
	accessToken, err := jwt.NewWithClaims(handlers.SigningMethod, &claims).SignedString(handlers.Key)
	fatal.OnError(err)
	return
}

func (handlers *Handlers) createRefreshToken(account *Account) (refreshToken string) {
	expiry := time.Now().Add(handlers.RefreshTokenDuration)
	claims := internal.Claims{
		Issuer:   "baby-monitor",
		Audience: "baby-monitor",
		Subject: internal.URN{
			Service:      "iam",
			Region:       "",
			AccountID:    account.ID,
			ResourceType: "user",
			ResourceID:   account.User.ID,
		},
		Expiry: expiry.Unix(),
		Scope:  "refresh_token",
	}
	refreshToken, err := jwt.NewWithClaims(handlers.SigningMethod, &claims).SignedString(handlers.Key)
	fatal.OnError(err)
	return
}

func (handlers *Handlers) createRefreshTokenCookie(account *Account) *http.Cookie {
	// TODO don't need to do this every time
	domain := handlers.FrontendURL.Hostname()
	index := strings.Index(domain, ".")
	if index != -1 {
		domain = domain[index:]
	}
	return &http.Cookie{
		Name:     "refresh_token",
		Value:    handlers.createRefreshToken(account),
		Domain:   domain,
		Path:     "/token",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteStrictMode,
	}
}

func (handlers *Handlers) getKey(token *jwt.Token) (key interface{}, err error) {
	switch v := handlers.Key.(type) {
	case *rsa.PrivateKey:
		key = &v.PublicKey
		return
	default:
		key = handlers.Key
		return
	}
}
