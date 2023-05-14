package account

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"time"

	"github.com/ansel1/merry"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	"github.com/ryan/baby-monitor/backend/internal/fatal"
	uuid "github.com/satori/go.uuid"
)

type Handlers struct {
	AccountStore        AccountStore
	DeviceStore         DeviceStore
	SigningMethod       jwt.SigningMethod
	Key                 interface{}
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
	accountID := uuid.NewV4().String()
	passwordSalt := make([]byte, 32)
	_, err = rand.Read(passwordSalt)
	if err != nil {
		return
	}
	passwordHash := calculatePasswordHash(input.Password, passwordSalt)
	account := Account{
		AccountID:    accountID,
		Email:        input.Email,
		PasswordSalt: passwordSalt,
		PasswordHash: passwordHash,
	}
	err = handlers.AccountStore.Put(&account)
	if err != nil {
		return
	}
	handlers.addAccessTokenCookie(responseWriter, account.AccountID)
	responseWriter.Header().Set("Content-Type", "application/json")
	json.NewEncoder(responseWriter).Encode(account)
}

func (handlers *Handlers) Login(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		}
	}()
	email := request.FormValue("email")
	password := request.FormValue("password")
	account, err := handlers.AccountStore.GetByEmail(email)
	if err != nil {
		err = merry.New("invalid email or password").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	passwordHash := calculatePasswordHash(password, account.PasswordSalt)
	if !bytes.Equal(passwordHash, account.PasswordHash) {
		err = merry.New("invalid email or password").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	handlers.addAccessTokenCookie(responseWriter, account.AccountID)
}

func (handlers *Handlers) GetAccount(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		}
	}()
	ctx := request.Context()
	accountID := GetAccountIDFromContext(ctx)
	account, err := handlers.AccountStore.Get(accountID)
	if err != nil {
		return
	}
	json.NewEncoder(responseWriter).Encode(account)
}

func (handlers *Handlers) DeleteAccount(responseWriter http.ResponseWriter, request *http.Request) {
	ctx := request.Context()
	accountID := GetAccountIDFromContext(ctx)
	err := handlers.AccountStore.Remove(accountID)
	if err != nil {
		http.Error(responseWriter, err.Error(), http.StatusInternalServerError)
		return
	}
}

type AddDeviceInput struct {
	Name string `json:"name"`
	Tags Tags   `json:"tags"`
}

func (input *AddDeviceInput) Validate() (err error) {
	if input.Name == "" {
		err = merry.New("name is required").WithHTTPCode(http.StatusBadRequest)
		return
	}
	return input.Tags.Validate()
}

func (handlers *Handlers) AddDevice(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		}
	}()
	ctx := request.Context()
	var input AddDeviceInput
	err = json.NewDecoder(request.Body).Decode(&input)
	if err != nil {
		return
	}
	err = input.Validate()
	if err != nil {
		return
	}
	deviceID := uuid.NewV4().String()
	device := Device{
		DeviceID: deviceID,
		Name:     input.Name,
		Tags:     input.Tags,
	}
	err = handlers.DeviceStore.Put(ctx, &device)
	if err != nil {
		return
	}
	json.NewEncoder(responseWriter).Encode(device)
}

func (handlers *Handlers) GetDevice(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		}
	}()
	deviceID := mux.Vars(request)["device_id"]
	ctx := request.Context()
	device, err := handlers.DeviceStore.Get(ctx, deviceID)
	if err != nil {
		return
	}
	json.NewEncoder(responseWriter).Encode(device)
}

func (handlers *Handlers) ListDevices(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		}
	}()
	ctx := request.Context()
	input, err := handlers.CreateListInputFromRequest(request)
	if err != nil {
		return
	}
	devices, err := handlers.DeviceStore.List(ctx, input)
	if err != nil {
		return
	}
	json.NewEncoder(responseWriter).Encode(devices)
}

func (handlers *Handlers) CreateListInputFromRequest(request *http.Request) (input ListInput, err error) {
	query := request.URL.Query()
	tags := query["tag"]
	input.Tags = make([]Tag, 0, len(tags))
	for _, tag := range tags {
		input.Tags = append(input.Tags, Tag(tag))
	}
	err = input.Validate()
	if err != nil {
		return
	}
	return
}

func (handlers *Handlers) RemoveDevice(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		}
	}()
	deviceID := mux.Vars(request)["device_id"]
	ctx := request.Context()
	err = handlers.DeviceStore.Remove(ctx, deviceID)
	if err != nil {
		return
	}
}

func (handlers *Handlers) AddRoutes(router *mux.Router) {
	router.HandleFunc("/login", handlers.Login).Methods(http.MethodPost).Name("Login")

	accountRouter := router.PathPrefix("/accounts").Subrouter()
	accountRouter.HandleFunc("", handlers.CreateAccount).Methods(http.MethodPost).Name("CreateAccount")

	authenticatedRouter := router.PathPrefix("/accounts/{account_id}").Subrouter()
	authenticatedRouter.Use(handlers.AuthorizationMiddleware)
	accountRouter.HandleFunc("/{account_id}", handlers.GetAccount).Methods(http.MethodGet).Name("GetAccount")
	accountRouter.HandleFunc("/{account_id}", handlers.DeleteAccount).Methods(http.MethodDelete).Name("DeleteAccount")

	deviceRouter := authenticatedRouter.PathPrefix("/devices").Subrouter()
	deviceRouter.Use(handlers.AuthorizationMiddleware)
	deviceRouter.HandleFunc("", handlers.AddDevice).Methods(http.MethodPost).Name("AddDevice")
	deviceRouter.HandleFunc("", handlers.ListDevices).Methods(http.MethodGet).Name("ListDevices")
	deviceRouter.HandleFunc("/{device_id}", handlers.GetDevice).Methods(http.MethodGet).Name("GetDevice")
	deviceRouter.HandleFunc("/{device_id}", handlers.RemoveDevice).Methods(http.MethodDelete).Name("RemoveDevice")
}

func (handlers *Handlers) AuthorizationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		var err error
		defer func() {
			if err != nil {
				http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
			}
		}()
		cookie, err := request.Cookie("access_token")
		if err != nil {
			err = merry.New("access_token cookie is required").WithHTTPCode(http.StatusUnauthorized)
			return
		}
		accessToken := cookie.Value
		var claims Claims
		_, err = jwt.ParseWithClaims(accessToken, &claims, handlers.getKey)
		if err != nil {
			err = merry.New("invalid access_token").WithHTTPCode(http.StatusUnauthorized)
			return
		}
		vars := mux.Vars(request)
		accountID := vars["account_id"]
		if claims.Subject != accountID {
			err = merry.New("invalid access_token").WithHTTPCode(http.StatusUnauthorized)
			return
		}
		ctx := request.Context()
		ctx = ContextWithAccountID(ctx, accountID)
		next.ServeHTTP(responseWriter, request.Clone(ctx))
	})
}

func (handlers *Handlers) getKey(token *jwt.Token) (key interface{}, err error) {
	key = handlers.Key
	return
}

func (handlers *Handlers) addAccessTokenCookie(responseWriter http.ResponseWriter, accountID string) {
	expiry := time.Now().Add(handlers.AccessTokenDuration)
	claims := Claims{
		Issuer:   "signal",
		Audience: "signal",
		Subject:  accountID,
		Expiry:   expiry.Unix(),
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &claims).SignedString(handlers.Key)
	fatal.OnError(err)
	cookie := http.Cookie{
		Name:    "access_token",
		Value:   accessToken,
		Expires: expiry,
	}
	http.SetCookie(responseWriter, &cookie)
}

type Claims struct {
	Issuer   string `json:"iss"`
	Audience string `json:"aud"`
	Subject  string `json:"sub"`
	Expiry   int64  `json:"exp"`
}

func (claims *Claims) Valid() (err error) {
	if claims.Issuer != "signal" {
		err = merry.New("invalid issuer").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	if claims.Audience != "signal" {
		err = merry.New("invalid audience").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	if claims.Expiry < time.Now().Unix() {
		err = merry.New("token has expired").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	return
}
