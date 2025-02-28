package accounts

import (
	"crypto/rand"
	"encoding/json"
	"io"
	"log"
	"net/http"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mailer"
	"github.com/Ryan-A-B/beddybytes/golang/internal/xhttp"
	"github.com/ansel1/merry"
)

type RequestPasswordResetInput struct {
	Email string `json:"email"`
}

type ResetPasswordInput struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

func (input *ResetPasswordInput) Validate() (err error) {
	defer func() {
		if err != nil {
			err = xhttp.ErrorWithCode(err, "invalid_input")
		}
	}()
	if input.Token == "" {
		err = merry.New("token is required").WithHTTPCode(http.StatusBadRequest)
		err = merry.WithUserMessage(err, "token is required")
		return
	}
	if len(input.Password) < 20 {
		err = merry.New("password is too short").WithHTTPCode(http.StatusBadRequest)
		err = merry.WithUserMessage(err, "password must be at least 20 characters")
		return
	}
	return
}

func (handlers *Handlers) RequestPasswordReset(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			log.Println("Warn:", err)
			xhttp.Error(responseWriter, err)
			return
		}
	}()
	err = handlers.CheckAnonymousAuthorization(request, "iam:RequestPasswordReset")
	if err != nil {
		return
	}
	var input RequestPasswordResetInput
	err = json.NewDecoder(request.Body).Decode(&input)
	if err != nil {
		log.Println("Error decoding request body:", err)
		err = merry.WithHTTPCode(err, http.StatusBadRequest)
		err = merry.WithUserMessage(err, "unable to parse request body")
		err = xhttp.ErrorWithCode(err, "invalid_input")
		return
	}
	if input.Email == "" {
		err = merry.New("email is required").WithHTTPCode(http.StatusBadRequest)
		err = merry.WithUserMessage(err, "email is required")
		err = xhttp.ErrorWithCode(err, "invalid_input")
		return
	}
	if !EmailPattern.MatchString(input.Email) {
		err = merry.New("invalid email").WithHTTPCode(http.StatusBadRequest)
		err = merry.WithUserMessage(err, "invalid email")
		err = xhttp.ErrorWithCode(err, "invalid_input")
		return
	}
	ctx := request.Context()
	account, err := handlers.AccountStore.GetByEmail(ctx, input.Email)
	if err != nil {
		log.Println("attempting to reset password for unknown email:", input.Email)
		err = nil
		return
	}
	token := handlers.PasswordResetTokens.Create(input.Email)
	err = handlers.Mailer.SendPasswordResetLink(ctx, mailer.SendPasswordResetLinkInput{
		Email: account.User.Email,
		Token: token,
	})
	if err != nil {
		log.Println("Error sending password reset email:", err)
		return
	}
}

func (handlers *Handlers) ResetPassword(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			log.Println("Warn:", err)
			xhttp.Error(responseWriter, err)
			return
		}
	}()
	err = handlers.CheckAnonymousAuthorization(request, "iam:ResetPassword")
	if err != nil {
		return
	}
	var input ResetPasswordInput
	err = json.NewDecoder(request.Body).Decode(&input)
	if err != nil {
		log.Println("Error decoding request body:", err)
		err = merry.WithHTTPCode(err, http.StatusBadRequest)
		err = merry.WithUserMessage(err, "unable to parse request body")
		err = xhttp.ErrorWithCode(err, "invalid_input")
		return
	}
	err = input.Validate()
	if err != nil {
		log.Println("Validation error:", err)
		return
	}
	ok := handlers.PasswordResetTokens.Consume(input.Token, func(email string) {
		ctx := request.Context()
		salt := make([]byte, 32)
		_, err = io.ReadFull(rand.Reader, salt)
		if err != nil {
			log.Println("Error generating salt:", err)
			return
		}
		passwordHash := calculatePasswordHash(input.Password, salt)
		payload := PasswordResetData{
			Email:        email,
			PasswordSalt: salt,
			PasswordHash: passwordHash,
		}
		_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
			Type: EventTypeAccountPasswordReset,
			Data: fatal.UnlessMarshalJSON(payload),
		})
		fatal.OnError(err)
	})
	if !ok {
		err = merry.New("invalid or expired token").WithHTTPCode(http.StatusBadRequest)
		err = merry.WithUserMessage(err, "invalid or expired token")
		return
	}
}
