package httpx_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ansel1/merry"
	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
)

func TestError(t *testing.T) {
	Convey("TestError", t, func() {
		var err error
		recorder := httptest.NewRecorder()
		Convey("error", func() {
			Convey("with no user message or code", func() {
				err = merry.New("bad request").WithHTTPCode(http.StatusBadRequest)
				httpx.Error(recorder, err)
				var frame httpx.ErrorFrame
				err = json.NewDecoder(recorder.Body).Decode(&frame)
				So(err, ShouldBeNil)
				So(frame.Code, ShouldEqual, "")
				So(frame.Message, ShouldEqual, "")
			})

			Convey("with user message", func() {
				message := uuid.NewV4().String()
				err = merry.New("bad request").WithHTTPCode(http.StatusBadRequest)
				err = merry.WithUserMessage(err, message)
				httpx.Error(recorder, err)
				var frame httpx.ErrorFrame
				err = json.NewDecoder(recorder.Body).Decode(&frame)
				So(err, ShouldBeNil)
				So(frame.Code, ShouldEqual, "")
				So(frame.Message, ShouldEqual, message)
			})

			Convey("with code", func() {
				code := uuid.NewV4().String()
				err = merry.New("bad request").WithHTTPCode(http.StatusBadRequest)
				err = httpx.ErrorWithCode(err, code)
				httpx.Error(recorder, err)
				var frame httpx.ErrorFrame
				err = json.NewDecoder(recorder.Body).Decode(&frame)
				So(err, ShouldBeNil)
				So(frame.Code, ShouldEqual, code)
				So(frame.Message, ShouldEqual, "")
			})

			Convey("with user message and code", func() {
				code := uuid.NewV4().String()
				message := uuid.NewV4().String()
				err = merry.New("bad request").WithHTTPCode(http.StatusBadRequest)
				err = httpx.ErrorWithCode(err, code)
				err = merry.WithUserMessage(err, message)
				httpx.Error(recorder, err)
				var frame httpx.ErrorFrame
				err = json.NewDecoder(recorder.Body).Decode(&frame)
				So(err, ShouldBeNil)
				So(frame.Code, ShouldEqual, code)
				So(frame.Message, ShouldEqual, message)
			})
		})
	})
}
