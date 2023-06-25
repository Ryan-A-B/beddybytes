package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/url"
	"testing"

	"github.com/Ryan-A-B/baby-monitor/backend/accounts"
	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"
)

func TestProduction(t *testing.T) {
	t.Skip("Skipping integration tests")
	Convey("TestProduction", t, func() {
		target := url.URL{
			Scheme: "https",
			Host:   "api.babymonitor.creativeilk.com",
		}
		Convey("GetAnonymousAccessToken", func() {
			target.Path = "/anonymous_token"
			request, err := http.NewRequest(http.MethodPost, target.String(), nil)
			So(err, ShouldBeNil)
			response, err := http.DefaultClient.Do(request)
			So(err, ShouldBeNil)
			So(response.StatusCode, ShouldEqual, 200)
			var anonymousAccessTokenOutput accounts.AccessTokenOutput
			err = json.NewDecoder(response.Body).Decode(&anonymousAccessTokenOutput)
			So(err, ShouldBeNil)
			So(anonymousAccessTokenOutput.TokenType, ShouldEqual, "Bearer")
			So(anonymousAccessTokenOutput.AccessToken, ShouldNotBeEmpty)
			Convey("CreateAccount", func() {
				target.Path = "/accounts"
				input := accounts.CreateAccountInput{
					Email:    "test@example.com",
					Password: uuid.NewV4().String(),
				}
				payload, err := json.Marshal(input)
				So(err, ShouldBeNil)
				request, err := http.NewRequest(http.MethodPost, target.String(), bytes.NewBuffer(payload))
				So(err, ShouldBeNil)
				request.Header.Set("Authorization", "Bearer "+anonymousAccessTokenOutput.AccessToken)
				response, err := http.DefaultClient.Do(request)
				So(err, ShouldBeNil)
				So(response.StatusCode, ShouldEqual, 200)
				var account accounts.Account
				err = json.NewDecoder(response.Body).Decode(&account)
				So(err, ShouldBeNil)
				So(account.ID, ShouldNotBeEmpty)
				So(account.User.ID, ShouldNotBeEmpty)
				So(account.User.Email, ShouldEqual, input.Email)
				So(account.User.PasswordSalt, ShouldNotBeEmpty)
				So(account.User.PasswordHash, ShouldNotBeEmpty)
				Convey("GetAccessToken", func() {
					target.Path = "/token"
					query := make(url.Values)
					query.Set("grant_type", "password")
					query.Set("username", input.Email)
					query.Set("password", input.Password)
					target.RawQuery = query.Encode()
					request, err := http.NewRequest(http.MethodPost, target.String(), nil)
					So(err, ShouldBeNil)
					response, err := http.DefaultClient.Do(request)
					So(err, ShouldBeNil)
					So(response.StatusCode, ShouldEqual, 200)
					var accessTokenOutput accounts.AccessTokenOutput
					err = json.NewDecoder(response.Body).Decode(&accessTokenOutput)
					So(err, ShouldBeNil)
					Convey("DeleteAccount", func() {
						target.Path = "/accounts/" + account.ID
						target.RawQuery = ""
						request, err := http.NewRequest(http.MethodDelete, target.String(), nil)
						So(err, ShouldBeNil)
						request.Header.Set("Authorization", "Bearer "+accessTokenOutput.AccessToken)
						response, err := http.DefaultClient.Do(request)
						So(err, ShouldBeNil)
						So(response.StatusCode, ShouldEqual, 200)
					})
				})
			})
		})
	})
}
