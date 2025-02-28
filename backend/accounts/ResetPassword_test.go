package accounts_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/backend/accounts"
	"github.com/Ryan-A-B/beddybytes/backend/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/backend/internal/mailer"
	"github.com/Ryan-A-B/beddybytes/backend/internal/resetpassword"
	"github.com/Ryan-A-B/beddybytes/backend/internal/store"
	"github.com/gorilla/mux"
	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"
)

func TestResetPassword(t *testing.T) {
	Convey("TestResetPassword", t, func() {
		ctx := context.Background()
		email := "test@example.com"
		mailer := new(MockPasswordResetMailer)
		handlers := accounts.Handlers{
			EventLog: newEventLog(ctx),
			AccountStore: &accounts.AccountStore{
				Store: store.NewMemoryStore(),
			},
			PasswordResetTokens: resetpassword.NewTokens(resetpassword.NewTokensInput{
				TTL: 100 * time.Millisecond,
			}),
			Mailer: mailer,
		}
		router := mux.NewRouter()
		handlers.AddRoutes(router)
		user := accounts.NewUser(&accounts.NewUserInput{
			Email:    email,
			Password: uuid.NewV4().String(),
		})
		account := accounts.Account{
			ID:   uuid.NewV4().String(),
			User: user,
		}
		data, err := json.Marshal(&account)
		So(err, ShouldBeNil)
		_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
			Type: accounts.EventTypeAccountCreated,
			Data: data,
		})
		So(err, ShouldBeNil)
		go eventlog.Project(ctx, &eventlog.ProjectInput{
			EventLog:   handlers.EventLog,
			FromCursor: 0,
			Apply:      handlers.ApplyEvent,
		})
		// Allow time for the event to be processed
		time.Sleep(10 * time.Millisecond)
		Convey("ForgotPassword", func() {
			Convey("valid request", func() {
				Convey("known email", func() {
					input := accounts.RequestPasswordResetInput{
						Email: email,
					}
					data, err := json.Marshal(input)
					So(err, ShouldBeNil)
					request := httptest.NewRequest(http.MethodPost, "/request-password-reset", bytes.NewReader(data))
					response := httptest.NewRecorder()
					router.ServeHTTP(response, request)
					So(response.Code, ShouldEqual, http.StatusOK)
					So(mailer.Email, ShouldEqual, email)
					So(mailer.Token, ShouldNotBeEmpty)
				})
				Convey("unknown email", func() {
					input := accounts.RequestPasswordResetInput{
						Email: "foo@example.com",
					}
					data, err := json.Marshal(input)
					So(err, ShouldBeNil)
					request := httptest.NewRequest(http.MethodPost, "/request-password-reset", bytes.NewReader(data))
					response := httptest.NewRecorder()
					router.ServeHTTP(response, request)
					So(response.Code, ShouldEqual, http.StatusOK)
					So(mailer.Email, ShouldBeEmpty)
					So(mailer.Token, ShouldBeEmpty)
				})
			})
			// TODO invalid requests? leave that for fuzzing?
		})
		Convey("ResetPassword", func() {
			input := accounts.RequestPasswordResetInput{
				Email: email,
			}
			data, err := json.Marshal(input)
			So(err, ShouldBeNil)
			request := httptest.NewRequest(http.MethodPost, "/request-password-reset", bytes.NewReader(data))
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			So(response.Code, ShouldEqual, http.StatusOK)
			So(mailer.Email, ShouldEqual, email)
			token := mailer.Token
			Convey("valid request", func() {
				Convey("success", func() {
					input := accounts.ResetPasswordInput{
						Token:    token,
						Password: uuid.NewV4().String(),
					}
					data, err := json.Marshal(input)
					So(err, ShouldBeNil)
					request := httptest.NewRequest(http.MethodPost, "/reset-password", bytes.NewReader(data))
					response := httptest.NewRecorder()
					router.ServeHTTP(response, request)
					So(response.Code, ShouldEqual, http.StatusOK)
				})
				Convey("unknown token", func() {
					input := accounts.ResetPasswordInput{
						Token:    uuid.NewV4().String(),
						Password: uuid.NewV4().String(),
					}
					data, err := json.Marshal(input)
					So(err, ShouldBeNil)
					request := httptest.NewRequest(http.MethodPost, "/reset-password", bytes.NewReader(data))
					response := httptest.NewRecorder()
					router.ServeHTTP(response, request)
					So(response.Code, ShouldEqual, http.StatusBadRequest)
				})
				Convey("expired token", func() {
					input := accounts.ResetPasswordInput{
						Token:    token,
						Password: uuid.NewV4().String(),
					}
					data, err := json.Marshal(input)
					So(err, ShouldBeNil)
					request := httptest.NewRequest(http.MethodPost, "/reset-password", bytes.NewReader(data))
					response := httptest.NewRecorder()
					time.Sleep(200 * time.Millisecond)
					router.ServeHTTP(response, request)
					So(response.Code, ShouldEqual, http.StatusBadRequest)
				})
			})
			// TODO invalid requests? leave that for fuzzing?
		})
	})
}

type MockPasswordResetMailer struct {
	Email string
	Token string
}

func (mailer *MockPasswordResetMailer) SendPasswordResetLink(ctx context.Context, input mailer.SendPasswordResetLinkInput) (err error) {
	mailer.Email = input.Email
	mailer.Token = input.Token
	return
}
