package accounts

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/Ryan-A-B/beddybytes/golang/internal/accountrepository"
	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mailer"
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
			err = httpx.ErrorWithCode(err, "invalid_input")
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
			httpx.Error(responseWriter, err)
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
		err = httpx.ErrorWithCode(err, "invalid_input")
		return
	}
	if input.Email == "" {
		err = merry.New("email is required").WithHTTPCode(http.StatusBadRequest)
		err = merry.WithUserMessage(err, "email is required")
		err = httpx.ErrorWithCode(err, "invalid_input")
		return
	}
	if !EmailPattern.MatchString(input.Email) {
		err = merry.New("invalid email").WithHTTPCode(http.StatusBadRequest)
		err = merry.WithUserMessage(err, "invalid email")
		err = httpx.ErrorWithCode(err, "invalid_input")
		return
	}
	ctx := request.Context()
	userID := accountrepository.UserID{
		Issuer:  accountrepository.IssuerBeddybytes,
		Subject: input.Email,
	}
	_, err = handlers.AccountQueryHandler.GetAccountIDForUser(ctx, userID)
	if err != nil {
		err = merry.WithHTTPCode(err, http.StatusBadRequest)
		return
	}
	token := handlers.PasswordResetTokens.Create(input.Email)
	err = handlers.Mailer.SendPasswordResetLink(ctx, mailer.SendPasswordResetLinkInput{
		Email: input.Email,
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
			httpx.Error(responseWriter, err)
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
		err = httpx.ErrorWithCode(err, "invalid_input")
		return
	}
	err = input.Validate()
	if err != nil {
		log.Println("Validation error:", err)
		return
	}
	ok := handlers.PasswordResetTokens.Consume(input.Token, func(email string) {
		ctx := request.Context()
		err = handlers.AccountCommandHandler.ResetPassword(ctx, accountrepository.ResetPasswordInput{
			Email:    email,
			Password: input.Password,
		})
	})
	if !ok {
		err = merry.New("invalid or expired token").WithHTTPCode(http.StatusBadRequest)
		err = merry.WithUserMessage(err, "invalid or expired token")
		return
	}
	if err != nil {
		err = merry.WithUserMessage(merry.WithHTTPCode(err, http.StatusBadRequest), "unable to reset password")
	}
}
