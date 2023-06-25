package main

import (
	"crypto/tls"
	"net/http"
	"net/url"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestRateLimit(t *testing.T) {
	client := http.Client{
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{
				InsecureSkipVerify: true,
			},
		},
	}
	Convey("TestRateLimit", t, func() {
		Convey("AnonymousToken", func() {
			target := url.URL{
				Scheme: "https",
				Host:   "api.babymonitor.local:8443",
				Path:   "/anonymous_token",
			}
			for i := 0; i < 1; i++ {
				request, err := http.NewRequest(http.MethodPost, target.String(), nil)
				So(err, ShouldBeNil)
				response, err := client.Do(request)
				So(err, ShouldBeNil)
				So(response.StatusCode, ShouldEqual, http.StatusOK)
			}
			request, err := http.NewRequest(http.MethodPost, target.String(), nil)
			So(err, ShouldBeNil)
			response, err := client.Do(request)
			So(err, ShouldBeNil)
			So(response.StatusCode, ShouldEqual, http.StatusTooManyRequests)
		})
		Convey("Options", func() {
			target := url.URL{
				Scheme: "https",
				Host:   "api.babymonitor.local:8443",
				Path:   "/token",
			}
			for i := 0; i < 5; i++ {
				request, err := http.NewRequest(http.MethodOptions, target.String(), nil)
				So(err, ShouldBeNil)
				response, err := client.Do(request)
				So(err, ShouldBeNil)
				So(response.StatusCode, ShouldEqual, http.StatusOK)
			}
			request, err := http.NewRequest(http.MethodOptions, target.String(), nil)
			So(err, ShouldBeNil)
			response, err := client.Do(request)
			So(err, ShouldBeNil)
			So(response.StatusCode, ShouldEqual, http.StatusTooManyRequests)
		})
	})
}
