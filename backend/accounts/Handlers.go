package accounts

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"time"

	"github.com/ansel1/merry"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	"github.com/ryan/baby-monitor/backend/internal"
	"github.com/ryan/baby-monitor/backend/internal/fatal"
	uuid "github.com/satori/go.uuid"
)

type Handlers struct {
	AccountStore        AccountStore
	SigningMethod       jwt.SigningMethod
	Key                 []byte
	AccessTokenDuration time.Duration
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
	err = handlers.AccountStore.Put(&account)
	if err != nil {
		return
	}
	responseWriter.Header().Set("Content-Type", "application/json")
	json.NewEncoder(responseWriter).Encode(account)
}

type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginOutput struct {
	TokenType   string `json:"token_type"`
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
}

func (handlers *Handlers) Login(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		}
	}()
	var input LoginInput
	err = json.NewDecoder(request.Body).Decode(&input)
	if err != nil {
		err = merry.WithHTTPCode(err, http.StatusBadRequest)
		return
	}
	account, err := handlers.AccountStore.GetByEmail(input.Email)
	if err != nil {
		err = merry.New("unauthorized").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	passwordHash := calculatePasswordHash(input.Password, account.User.PasswordSalt)
	if !bytes.Equal(passwordHash, account.User.PasswordHash) {
		err = merry.New("unauthorized").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	expiry := time.Now().Add(handlers.AccessTokenDuration)
	accessToken := handlers.createAccessToken(account, expiry)
	output := LoginOutput{
		TokenType:   "Bearer",
		AccessToken: accessToken,
		ExpiresIn:   int(handlers.AccessTokenDuration.Seconds()),
	}
	json.NewEncoder(responseWriter).Encode(output)
}

func (handlers *Handlers) GetAccount(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		}
	}()
	ctx := request.Context()
	accountID := internal.GetAccountIDFromContext(ctx)
	account, err := handlers.AccountStore.Get(accountID)
	if err != nil {
		return
	}
	json.NewEncoder(responseWriter).Encode(account)
}

func (handlers *Handlers) DeleteAccount(responseWriter http.ResponseWriter, request *http.Request) {
	ctx := request.Context()
	accountID := internal.GetAccountIDFromContext(ctx)
	err := handlers.AccountStore.Remove(accountID)
	if err != nil {
		http.Error(responseWriter, err.Error(), http.StatusInternalServerError)
		return
	}
}

func (handlers *Handlers) AddRoutes(router *mux.Router) {
	router.HandleFunc("/login", handlers.Login).Methods(http.MethodPost).Name("Login")

	accountRouter := router.PathPrefix("/accounts").Subrouter()
	accountRouter.HandleFunc("", handlers.CreateAccount).Methods(http.MethodPost).Name("CreateAccount")

	authenticatedRouter := accountRouter.PathPrefix("/{account_id}").Subrouter()
	authenticatedRouter.Use(internal.NewAuthorizationMiddleware(handlers.Key).Middleware)
	authenticatedRouter.HandleFunc("", handlers.GetAccount).Methods(http.MethodGet).Name("GetAccount")
	authenticatedRouter.HandleFunc("", handlers.DeleteAccount).Methods(http.MethodDelete).Name("DeleteAccount")
}

func (handlers *Handlers) createAccessToken(account *Account, expiry time.Time) (accessToken string) {
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
