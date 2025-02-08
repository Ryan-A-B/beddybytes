package httpx

import (
	"encoding/json"
	"net/http"

	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/ansel1/merry"
)

type ErrorKey int

const ErrorKeyCode ErrorKey = 0

func ErrorWithCode(err error, code string) merry.Error {
	return merry.WithValue(err, ErrorKeyCode, code)
}

func GetCode(err error) string {
	v := merry.Value(err, ErrorKeyCode)
	if v == nil {
		return ""
	}
	value, ok := v.(string)
	fatal.Unless(ok, "unexpected type")
	return value
}

type ErrorFrame struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Adaptation of http.Error
func Error(responseWriter http.ResponseWriter, err error) {
	responseWriter.Header().Set("Content-Type", "application/json")
	responseWriter.Header().Set("X-Content-Type-Options", "nosniff")
	responseWriter.WriteHeader(merry.HTTPCode(err))
	json.NewEncoder(responseWriter).Encode(ErrorFrame{
		Code:    GetCode(err),
		Message: merry.UserMessage(err),
	})
}
