package accounts_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/accounts"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mailer"
	"github.com/Ryan-A-B/beddybytes/golang/internal/resetpassword"
	"github.com/Ryan-A-B/beddybytes/golang/internal/store"
	"github.com/dgrijalva/jwt-go"
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
			SigningMethod:                jwt.SigningMethodHS256,
			Key:                          generateKey(),
			UsedTokens:                   accounts.NewUsedTokens(),
			AnonymousAccessTokenDuration: 10 * time.Second,
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
		_, err = handlers.EventLog.Append(ctx, eventlog.AppendInput{
			Type: accounts.EventTypeAccountCreated,
			Data: data,
		})
		So(err, ShouldBeNil)
		go eventlog.Project(ctx, eventlog.ProjectInput{
			EventLog:   handlers.EventLog,
			FromCursor: 0,
			Apply:      handlers.ApplyEvent,
		})
		// Allow time for the event to be processed
		time.Sleep(10 * time.Millisecond)

		getAccessToken := func(scope string) string {
			form := make(url.Values)
			form.Set("scope", scope)
			payload := form.Encode()
			response := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodPost, "/anonymous_token", strings.NewReader(payload))
			request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
			request.Header.Set(("X-Forwarded-For"), "127.0.0.1")
			router.ServeHTTP(response, request)
			So(response.Code, ShouldEqual, http.StatusOK)
			var accessTokenOutput accounts.AccessTokenOutput
			err = json.NewDecoder(response.Body).Decode(&accessTokenOutput)
			So(err, ShouldBeNil)
			accessToken := accessTokenOutput.AccessToken
			return accessToken
		}

		Convey("ForgotPassword", func() {
			Convey("valid request", func() {
				Convey("known email", func() {
					input := accounts.RequestPasswordResetInput{
						Email: email,
					}
					data, err := json.Marshal(input)
					So(err, ShouldBeNil)
					accessToken := getAccessToken("iam:RequestPasswordReset")
					request := httptest.NewRequest(http.MethodPost, "/request-password-reset", bytes.NewReader(data))
					request.Header.Set("Authorization", "Bearer "+accessToken)
					request.Header.Set(("X-Forwarded-For"), "127.0.0.1")
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
					accessToken := getAccessToken("iam:RequestPasswordReset")
					request := httptest.NewRequest(http.MethodPost, "/request-password-reset", bytes.NewReader(data))
					request.Header.Set("Authorization", "Bearer "+accessToken)
					request.Header.Set(("X-Forwarded-For"), "127.0.0.1")
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
			accessToken := getAccessToken("iam:RequestPasswordReset")
			request := httptest.NewRequest(http.MethodPost, "/request-password-reset", bytes.NewReader(data))
			request.Header.Set("Authorization", "Bearer "+accessToken)
			request.Header.Set(("X-Forwarded-For"), "127.0.0.1")
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
					accessToken := getAccessToken("iam:ResetPassword")
					request := httptest.NewRequest(http.MethodPost, "/reset-password", bytes.NewReader(data))
					request.Header.Set("Authorization", "Bearer "+accessToken)
					request.Header.Set(("X-Forwarded-For"), "127.0.0.1")
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
					accessToken := getAccessToken("iam:ResetPassword")
					request := httptest.NewRequest(http.MethodPost, "/reset-password", bytes.NewReader(data))
					request.Header.Set("Authorization", "Bearer "+accessToken)
					request.Header.Set(("X-Forwarded-For"), "127.0.0.1")
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
					accessToken := getAccessToken("iam:ResetPassword")
					request := httptest.NewRequest(http.MethodPost, "/reset-password", bytes.NewReader(data))
					request.Header.Set("Authorization", "Bearer "+accessToken)
					request.Header.Set(("X-Forwarded-For"), "127.0.0.1")
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
