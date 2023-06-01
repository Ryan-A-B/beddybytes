package accounts_test

import (
	"crypto/rand"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	"github.com/ryan/baby-monitor/backend/accounts"
	"github.com/ryan/baby-monitor/backend/internal/fatal"
	. "github.com/smartystreets/goconvey/convey"
)

func TestHandlers(t *testing.T) {
	Convey("TestHandlers", t, func() {
		key := generateKey()
		handlers := accounts.Handlers{
			AccountStore:        accounts.NewAccountStoreInMemory(),
			SigningMethod:       jwt.SigningMethodHS256,
			Key:                 key,
			AccessTokenDuration: 1 * time.Hour,
		}
		router := mux.NewRouter()
		handlers.AddRoutes(router.NewRoute().Subrouter())
		server := httptest.NewServer(router)
		defer server.Close()
		client := server.Client()
		Convey("Options", func() {
			request, err := http.NewRequest(http.MethodOptions, server.URL+"/accounts", nil)
			So(err, ShouldBeNil)
			response, err := client.Do(request)
			So(err, ShouldBeNil)
			So(response.StatusCode, ShouldEqual, 200)
			So(response.Header.Get("Access-Control-Allow-Origin"), ShouldEqual, "*")
			So(response.Header.Get("Access-Control-Allow-Methods"), ShouldEqual, "POST,OPTIONS")
			So(response.Header.Get("Access-Control-Allow-Headers"), ShouldEqual, "Content-Type,Authorization")
		})
	})
}

func generateKey() (key []byte) {
	key = make([]byte, 32)
	_, err := io.ReadFull(rand.Reader, key)
	fatal.OnError(err)
	return
}
