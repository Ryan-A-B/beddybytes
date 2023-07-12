package main

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/baby-monitor/backend/accounts"
	"github.com/Ryan-A-B/baby-monitor/backend/internal/store"
)

func generateKey() []byte {
	key := make([]byte, 32)
	_, err := rand.Read(key)
	if err != nil {
		panic(err)
	}
	return key
}

func TestAccountCreation(t *testing.T) {
	Convey("TestAccountCreation", t, func() {
		key := generateKey()
		accountHandlers := accounts.Handlers{
			CookieDomain: "localhost",
			AccountStore: &accounts.AccountStore{
				Store: store.NewMemoryStore(),
			},
			SigningMethod:       jwt.SigningMethodHS256,
			Key:                 key,
			AccessTokenDuration: 1 * time.Hour,
		}
		handlers := Handlers{
			Upgrader: websocket.Upgrader{
				ReadBufferSize:  1024,
				WriteBufferSize: 1024,
				CheckOrigin: func(request *http.Request) bool {
					return true
				},
			},
			ClientStore: &LoggingDecorator{
				decorated: &LockingDecorator{
					decorated: &ClientStoreInMemory{
						clientsByAccountID: make(map[string]map[string]*Client),
					},
				},
			},
			Key: key,
		}
		router := mux.NewRouter()
		handlers.AddRoutes(router.NewRoute().Subrouter())
		accountHandlers.AddRoutes(router.NewRoute().Subrouter())
		server := httptest.NewServer(router)
		defer server.Close()
		client := server.Client()
		Convey("Create an account", func() {
			email := uuid.NewV4().String() + "@test.com"
			password := uuid.NewV4().String()
			input := accounts.CreateAccountInput{
				Email:    email,
				Password: password,
			}
			payload, err := json.Marshal(input)
			So(err, ShouldBeNil)
			request, err := http.NewRequest(http.MethodPost, server.URL+"/accounts", bytes.NewReader(payload))
			So(err, ShouldBeNil)
			response, err := client.Do(request)
			So(err, ShouldBeNil)
			So(response.StatusCode, ShouldEqual, http.StatusOK)
			var account accounts.Account
			err = json.NewDecoder(response.Body).Decode(&account)
			So(err, ShouldBeNil)
			So(account.ID, ShouldNotBeEmpty)
			So(account.User.ID, ShouldNotBeEmpty)
			So(account.User.Email, ShouldEqual, input.Email)
			So(account.User.PasswordSalt, ShouldNotBeNil)
			So(account.User.PasswordHash, ShouldNotBeNil)
			Convey("Login with the account", func() {
				values := make(url.Values)
				values.Set("grant_type", "password")
				values.Set("username", email)
				values.Set("password", password)
				request, err := http.NewRequest(http.MethodPost, server.URL+"/token", strings.NewReader(values.Encode()))
				So(err, ShouldBeNil)
				request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
				response, err := client.Do(request)
				So(err, ShouldBeNil)
				So(response.StatusCode, ShouldEqual, http.StatusOK)
				var loginOutput accounts.AccessTokenOutput
				err = json.NewDecoder(response.Body).Decode(&loginOutput)
				So(err, ShouldBeNil)
				So(loginOutput.TokenType, ShouldEqual, "Bearer")
				So(loginOutput.AccessToken, ShouldNotBeEmpty)
				So(loginOutput.ExpiresIn, ShouldBeGreaterThan, 0)
				Convey("Get the account", func() {
					request, err := http.NewRequest(http.MethodGet, server.URL+"/accounts/"+account.ID, nil)
					So(err, ShouldBeNil)
					request.Header.Set("Authorization", "Bearer "+loginOutput.AccessToken)
					response, err := client.Do(request)
					So(err, ShouldBeNil)
					So(response.StatusCode, ShouldEqual, http.StatusOK)
					var account accounts.Account
					err = json.NewDecoder(response.Body).Decode(&account)
					So(err, ShouldBeNil)
					So(account.ID, ShouldNotBeEmpty)
					So(account.User.ID, ShouldNotBeEmpty)
					So(account.User.Email, ShouldEqual, input.Email)
					So(account.User.PasswordSalt, ShouldNotBeNil)
					So(account.User.PasswordHash, ShouldNotBeNil)
				})
				Convey("Delete the account", func() {
					request, err := http.NewRequest(http.MethodDelete, server.URL+"/accounts/"+account.ID, nil)
					So(err, ShouldBeNil)
					request.Header.Set("Authorization", "Bearer "+loginOutput.AccessToken)
					response, err := client.Do(request)
					So(err, ShouldBeNil)
					So(response.StatusCode, ShouldEqual, http.StatusOK)
					Convey("Get the account", func() {
						request, err = http.NewRequest(http.MethodGet, server.URL+"/accounts/"+account.ID, nil)
						So(err, ShouldBeNil)
						request.Header.Set("Authorization", "Bearer "+loginOutput.AccessToken)
						response, err = client.Do(request)
						So(err, ShouldBeNil)
						So(response.StatusCode, ShouldEqual, http.StatusNotFound)
					})
				})
				Convey(("Get different account"), func() {
					request, err := http.NewRequest(http.MethodGet, server.URL+"/accounts/"+uuid.NewV4().String(), nil)
					So(err, ShouldBeNil)
					request.Header.Set("Authorization", "Bearer "+loginOutput.AccessToken)
					response, err := client.Do(request)
					So(err, ShouldBeNil)
					So(response.StatusCode, ShouldEqual, http.StatusForbidden)
				})
			})
			Convey("Login with the wrong password", func() {
				password := uuid.NewV4().String()
				values := make(url.Values)
				values.Set("grant_type", "password")
				values.Set("username", email)
				values.Set("password", password)
				request, err := http.NewRequest(http.MethodPost, server.URL+"/token", strings.NewReader(values.Encode()))
				So(err, ShouldBeNil)
				request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
				response, err := client.Do(request)
				So(err, ShouldBeNil)
				So(response.StatusCode, ShouldEqual, http.StatusUnauthorized)
			})
		})
	})
}
