package accounts_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/beddybytes/golang/accounts"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/store"
)

func TestHandlers(t *testing.T) {
	Convey("TestHandlers", t, func() {
		ctx := context.Background()
		handlers := accounts.Handlers{
			CookieDomain: "localhost",
			EventLog:     newEventLog(ctx),
			AccountStore: &accounts.AccountStore{
				Store: store.NewMemoryStore(),
			},
			SigningMethod:                jwt.SigningMethodHS256,
			Key:                          generateKey(),
			AccessTokenDuration:          1 * time.Hour,
			UsedTokens:                   accounts.NewUsedTokens(),
			AnonymousAccessTokenDuration: 10 * time.Second,
		}
		go eventlog.Project(ctx, &eventlog.ProjectInput{
			EventLog:   handlers.EventLog,
			FromCursor: 0,
			Apply:      handlers.ApplyEvent,
		})
		router := mux.NewRouter()
		handlers.AddRoutes(router.NewRoute().Subrouter())
		server := httptest.NewServer(router)
		defer server.Close()
		client := server.Client()
		Convey("GetAnonymousAccessToken", func() {
			request, err := http.NewRequest(http.MethodPost, server.URL+"/anonymous_token", nil)
			So(err, ShouldBeNil)
			request.Header.Set("X-Forwarded-For", "127.0.0.1")
			response, err := client.Do(request)
			So(err, ShouldBeNil)
			So(response.StatusCode, ShouldEqual, 200)
			var output accounts.AccessTokenOutput
			err = json.NewDecoder(response.Body).Decode(&output)
			So(err, ShouldBeNil)
			So(output.TokenType, ShouldEqual, "Bearer")
			So(output.AccessToken, ShouldNotBeEmpty)
			So(output.ExpiresIn, ShouldEqual, handlers.AnonymousAccessTokenDuration.Seconds())
			Convey("CreateAccount", func() {
				Convey("Success", func() {
					input := accounts.CreateAccountInput{
						Email:    "test@example.com",
						Password: "passwordpasswordpassword",
					}
					data, err := json.Marshal(input)
					So(err, ShouldBeNil)
					request, err := http.NewRequest(http.MethodPost, server.URL+"/accounts", bytes.NewReader(data))
					So(err, ShouldBeNil)
					request.Header.Set("X-Forwarded-For", "127.0.0.1")
					request.Header.Set("Authorization", "Bearer "+output.AccessToken)
					response, err := client.Do(request)
					So(err, ShouldBeNil)
					So(response.StatusCode, ShouldEqual, 200)

					Convey("Email already in use", func() {
						Convey("GetAnonymousAccessToken", func() {
							request, err := http.NewRequest(http.MethodPost, server.URL+"/anonymous_token", nil)
							So(err, ShouldBeNil)
							request.Header.Set("X-Forwarded-For", "127.0.0.1")
							response, err := client.Do(request)
							So(err, ShouldBeNil)
							So(response.StatusCode, ShouldEqual, 200)
							var output accounts.AccessTokenOutput
							err = json.NewDecoder(response.Body).Decode(&output)
							So(err, ShouldBeNil)

							Convey("CreateAccount", func() {
								request, err := http.NewRequest(http.MethodPost, server.URL+"/accounts", bytes.NewReader(data))
								So(err, ShouldBeNil)
								request.Header.Set("X-Forwarded-For", "127.0.0.1")
								request.Header.Set("Authorization", "Bearer "+output.AccessToken)
								response, err := client.Do(request)
								So(err, ShouldBeNil)
								So(response.StatusCode, ShouldEqual, 400)
								var errorFrame httpx.ErrorFrame
								err = json.NewDecoder(response.Body).Decode(&errorFrame)
								So(err, ShouldBeNil)
								So(errorFrame.Code, ShouldEqual, "email_already_in_use")
								So(errorFrame.Message, ShouldNotBeEmpty)
							})
						})
					})
				})
				Convey("Unauthorized", func() {
					Convey("No token", func() {
						input := accounts.CreateAccountInput{
							Email:    "test@example.com",
							Password: "passwordpasswordpassword",
						}
						data, err := json.Marshal(input)
						So(err, ShouldBeNil)
						request, err := http.NewRequest(http.MethodPost, server.URL+"/accounts", bytes.NewReader(data))
						So(err, ShouldBeNil)
						response, err := client.Do(request)
						So(err, ShouldBeNil)
						So(response.StatusCode, ShouldEqual, http.StatusUnauthorized)
						var errorFrame httpx.ErrorFrame
						err = json.NewDecoder(response.Body).Decode(&errorFrame)
						So(err, ShouldBeNil)
						So(errorFrame.Code, ShouldEqual, "unauthorized")
						So(errorFrame.Message, ShouldNotBeEmpty)
					})
				})
				Convey("invalid email", func() {
					input := accounts.CreateAccountInput{
						Email:    "test",
						Password: "passwordpasswordpassword",
					}
					data, err := json.Marshal(input)
					So(err, ShouldBeNil)
					request, err := http.NewRequest(http.MethodPost, server.URL+"/accounts", bytes.NewReader(data))
					So(err, ShouldBeNil)
					request.Header.Set("X-Forwarded-For", "127.0.0.1")
					request.Header.Set("Authorization", "Bearer "+output.AccessToken)
					response, err := client.Do(request)
					So(err, ShouldBeNil)
					So(response.StatusCode, ShouldEqual, http.StatusBadRequest)
					var errorFrame httpx.ErrorFrame
					err = json.NewDecoder(response.Body).Decode(&errorFrame)
					So(err, ShouldBeNil)
					So(errorFrame.Code, ShouldEqual, "invalid_input")
					So(errorFrame.Message, ShouldNotBeEmpty)
				})
			})
		})
	})
}

func generateKey() (key []byte) {
	key = make([]byte, 32)
	_, err := io.ReadFull(rand.Reader, key)
	fatal.OnError(err)
	return
}
