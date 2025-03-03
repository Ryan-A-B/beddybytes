package accounts

import (
	"bytes"
	"crypto/rsa"
	"encoding/json"
	"log"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/ansel1/merry"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	uuid "github.com/satori/go.uuid"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mailer"
	"github.com/Ryan-A-B/beddybytes/golang/internal/resetpassword"
)

type Mailer interface {
	mailer.PasswordResetMailer
}

type Handlers struct {
	CookieDomain                 string
	EventLog                     eventlog.EventLog
	AccountStore                 *AccountStore
	SigningMethod                jwt.SigningMethod
	Key                          interface{}
	AccessTokenDuration          time.Duration
	RefreshTokenDuration         time.Duration
	UsedTokens                   UsedTokens
	AnonymousAccessTokenDuration time.Duration
	PasswordResetTokens          *resetpassword.Tokens
	Mailer                       Mailer
}

func (handlers *Handlers) AddRoutes(router *mux.Router) {
	router.HandleFunc("/anonymous_token", handlers.AnonymousToken).Methods(http.MethodPost).Name("AnonymousToken")
	router.HandleFunc("/token", handlers.Token).Methods(http.MethodPost).Name("Token")
	router.HandleFunc("/accounts", handlers.CreateAccount).Methods(http.MethodPost).Name("CreateAccount")
	router.HandleFunc("/request-password-reset", handlers.RequestPasswordReset).Methods(http.MethodPost).Name("RequestPasswordReset")
	router.HandleFunc("/reset-password", handlers.ResetPassword).Methods(http.MethodPost).Name("ResetPassword")
	authenticatedRouter := router.PathPrefix("/accounts/{account_id}").Subrouter()
	authenticatedRouter.Use(internal.NewAuthorizationMiddleware(handlers.Key).Middleware)
	authenticatedRouter.HandleFunc("", handlers.GetAccount).Methods(http.MethodGet).Name("GetAccount")
	authenticatedRouter.HandleFunc("", handlers.DeleteAccount).Methods(http.MethodDelete).Name("DeleteAccount")
}

type UsedTokens struct {
	mutex sync.Mutex
	cache map[string]struct{}
}

func NewUsedTokens() UsedTokens {
	return UsedTokens{
		cache: make(map[string]struct{}),
	}
}

func (usedRefreshTokens *UsedTokens) TryAdd(key string) bool {
	usedRefreshTokens.mutex.Lock()
	defer usedRefreshTokens.mutex.Unlock()
	_, ok := usedRefreshTokens.cache[key]
	if ok {
		return false
	}
	usedRefreshTokens.cache[key] = struct{}{}
	return true
}

var allowedAnonymousScope = map[string]struct{}{
	"iam:CreateAccount":        {},
	"iam:RequestPasswordReset": {},
	"iam:ResetPassword":        {},
}

func (handlers *Handlers) AnonymousToken(responseWriter http.ResponseWriter, request *http.Request) {
	scope := request.FormValue("scope")
	if scope == "" {
		// Backwards compatibility
		scope = "iam:CreateAccount"
	}
	if _, ok := allowedAnonymousScope[scope]; !ok {
		httpx.Error(responseWriter, merry.New("invalid scope").WithHTTPCode(http.StatusBadRequest))
		return
	}
	remoteAddress := request.Header.Get("X-Forwarded-For")
	output := AccessTokenOutput{
		TokenType:   "Bearer",
		AccessToken: handlers.createAnonymousAccessToken(remoteAddress, scope),
		ExpiresIn:   int(handlers.AnonymousAccessTokenDuration.Seconds()),
	}
	responseWriter.Header().Set("Content-Type", "application/json")
	json.NewEncoder(responseWriter).Encode(output)
}

type CreateAccountInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

var EmailPattern = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+(\.[a-zA-Z]{2,})+$`)

func (input *CreateAccountInput) Validate() (err error) {
	defer func() {
		if err != nil {
			err = httpx.ErrorWithCode(err, "invalid_input")
		}
	}()
	if input.Email == "" {
		err = merry.New("email is required").WithHTTPCode(http.StatusBadRequest)
		err = merry.WithUserMessage(err, "email is required")
		return
	}
	if !EmailPattern.MatchString(input.Email) {
		err = merry.New("invalid email").WithHTTPCode(http.StatusBadRequest)
		err = merry.WithUserMessage(err, "invalid email")
		return
	}
	if len(input.Password) < 20 {
		err = merry.New("password is too short").WithHTTPCode(http.StatusBadRequest)
		err = merry.WithUserMessage(err, "password is too short")
		return
	}
	return
}

func (handlers *Handlers) CheckAnonymousAuthorization(request *http.Request, expectedScope string) (err error) {
	defer func() {
		if err != nil {
			err = merry.WithUserMessage(err, "Unauthorized")
			err = httpx.ErrorWithCode(err, "unauthorized")
		}
	}()
	const prefix = "Bearer "
	authorization := request.Header.Get("Authorization")
	if !strings.HasPrefix(authorization, prefix) {
		err = merry.New("invalid authorization header").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	accessToken := authorization[len(prefix):]
	var claims internal.Claims
	_, err = jwt.ParseWithClaims(accessToken, &claims, func(token *jwt.Token) (interface{}, error) {
		return handlers.Key, nil
	})
	if err != nil {
		err = merry.New("failed to parse access token: " + err.Error()).WithHTTPCode(http.StatusUnauthorized)
		return
	}
	if claims.Subject.ResourceType != "remote_address" {
		err = merry.New("invalid resource type: " + claims.Subject.ResourceType).WithHTTPCode(http.StatusUnauthorized)
		return
	}
	remoteAddress := request.Header.Get("X-Forwarded-For")
	if claims.Subject.ResourceID != remoteAddress {
		err = merry.New("invalid resource ID: " + claims.Subject.ResourceID).WithHTTPCode(http.StatusUnauthorized)
		return
	}
	if claims.Scope != expectedScope {
		err = merry.New("invalid scope: " + claims.Scope).WithHTTPCode(http.StatusUnauthorized)
		return
	}
	if added := handlers.UsedTokens.TryAdd(claims.ID); !added {
		err = merry.New("token already used: " + claims.ID).WithHTTPCode(http.StatusUnauthorized)
		return
	}
	return
}

func (handlers *Handlers) CreateAccount(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			log.Println("Warn:", err)
			httpx.Error(responseWriter, err)
		}
	}()
	err = handlers.CheckAnonymousAuthorization(request, "iam:CreateAccount")
	if err != nil {
		return
	}
	ctx := request.Context()
	var input CreateAccountInput
	err = json.NewDecoder(request.Body).Decode(&input)
	if err != nil {
		err = merry.WithHTTPCode(err, http.StatusBadRequest)
		err = merry.WithUserMessage(err, "unable to parse request body")
		err = httpx.ErrorWithCode(err, "invalid_input")
		return
	}
	err = input.Validate()
	if err != nil {
		return
	}
	err = handlers.AccountStore.checkEmail(ctx, input.Email)
	if err != nil {
		err = merry.WithUserMessage(err, "email already in use")
		err = httpx.ErrorWithCode(err, "email_already_in_use")
		return
	}
	user := NewUser(&NewUserInput{
		Email:    input.Email,
		Password: input.Password,
	})
	account := Account{
		ID:   uuid.NewV4().String(),
		User: user,
	}
	data, err := json.Marshal(account)
	fatal.OnError(err)
	_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
		Type: EventTypeAccountCreated,
		Data: data,
	})
	fatal.OnError(err)
	responseWriter.Header().Set("Content-Type", "application/json")
	json.NewEncoder(responseWriter).Encode(account)
}

type AccessTokenOutput struct {
	TokenType   string `json:"token_type"`
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
}

func (handlers *Handlers) Token(responseWriter http.ResponseWriter, request *http.Request) {
	// Note: uses concepts from https://tools.ietf.org/html/rfc6749 but is not an OAuth 2.0 implementation
	var err error
	defer func() {
		if err != nil {
			log.Println("Warn:", err)
			httpx.Error(responseWriter, err)
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
			log.Println("Warn:", err)
			httpx.Error(responseWriter, err)
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
		err = merry.New("account not found").WithUserMessage("unauthorized").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	passwordHash := calculatePasswordHash(password, account.User.PasswordSalt)
	if !bytes.Equal(passwordHash, account.User.PasswordHash) {
		err = merry.New("wrong password").WithUserMessage("unauthorized").WithHTTPCode(http.StatusUnauthorized)
		return
	}
	output := AccessTokenOutput{
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
			log.Println("Warn:", err)
			httpx.Error(responseWriter, err)
			return
		}
	}()
	ctx := request.Context()
	cookie, err := request.Cookie("refresh_token")
	if err != nil {
		log.Println(err)
		err = merry.Prepend(err, "missing refresh token cookie").WithUserMessage("unauthorized").WithHTTPCode(http.StatusUnauthorized)
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
	if added := handlers.UsedTokens.TryAdd(claims.ID); !added {
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
	output := AccessTokenOutput{
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
			log.Println("Warn:", err)
			httpx.Error(responseWriter, err)
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
			log.Println("Warn:", err)
			httpx.Error(responseWriter, err)
			return
		}
	}()
	ctx := request.Context()
	accountID := contextx.GetAccountID(ctx)
	account, err := handlers.AccountStore.Get(ctx, accountID)
	if err != nil {
		return
	}
	json.NewEncoder(responseWriter).Encode(account)
}

func (handlers *Handlers) DeleteAccount(responseWriter http.ResponseWriter, request *http.Request) {
	ctx := request.Context()
	accountID := contextx.GetAccountID(ctx)
	err := handlers.AccountStore.Remove(ctx, accountID)
	if err != nil {
		log.Println("Warn:", err)
		httpx.Error(responseWriter, err)
		return
	}
}

func (handlers *Handlers) createAnonymousAccessToken(remoteAddress string, scope string) (accessToken string) {
	expiry := time.Now().Add(handlers.AnonymousAccessTokenDuration)
	claims := internal.Claims{
		ID:       uuid.NewV4().String(),
		Issuer:   "beddybytes",
		Audience: "beddybytes",
		Subject: internal.URN{
			Service:      "",
			Region:       "",
			AccountID:    "",
			ResourceType: "remote_address",
			ResourceID:   remoteAddress,
		},
		Scope:  scope,
		Expiry: expiry.Unix(),
	}
	accessToken, err := jwt.NewWithClaims(handlers.SigningMethod, &claims).SignedString(handlers.Key)
	fatal.OnError(err)
	return
}

func (handlers *Handlers) createAccessToken(account *Account) (accessToken string) {
	expiry := time.Now().Add(handlers.AccessTokenDuration)
	claims := internal.Claims{
		Issuer:   "beddybytes",
		Audience: "beddybytes",
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
		ID:       uuid.NewV4().String(),
		Issuer:   "beddybytes",
		Audience: "beddybytes",
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
	return &http.Cookie{
		Name:     "refresh_token",
		Value:    handlers.createRefreshToken(account),
		Domain:   handlers.CookieDomain,
		Path:     "/token",
		HttpOnly: true,
		Secure:   true,
		Expires:  time.Now().Add(handlers.RefreshTokenDuration),
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
