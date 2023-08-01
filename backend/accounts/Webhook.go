package accounts

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"io/ioutil"
	"log"
	"net/http"

	"github.com/ansel1/merry"

	"github.com/Ryan-A-B/baby-monitor/backend/internal/eventlog"
	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
	"github.com/Ryan-A-B/baby-monitor/internal/square"
)

func (handlers *Handlers) HandleWebhook(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			log.Println(err)
			http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		}
	}()
	ctx := request.Context()
	signature, err := handlers.getSignature(request)
	if err != nil {
		return
	}
	payload, err := handlers.getPayload(request)
	if err != nil {
		return
	}
	requestURL := handlers.getRequestURL(request)
	err = handlers.checkSignature(signature, requestURL, payload)
	if err != nil {
		return
	}
	var event square.Event
	err = json.Unmarshal(payload, &event)
	if err != nil {
		return
	}
	handlers.EventLog.Append(ctx, &eventlog.AppendInput{
		Type: "square." + string(event.Type),
		Data: payload,
	})
}

func (handlers *Handlers) checkSignature(signature []byte, requestURL string, payload []byte) (err error) {
	hash := hmac.New(sha256.New, handlers.SignatureKey)
	_, err = io.WriteString(hash, requestURL)
	fatal.OnError(err)
	_, err = hash.Write(payload)
	fatal.OnError(err)
	sum := hash.Sum(nil)
	if !hmac.Equal(sum, signature) {
		err = merry.New("signature does not match").WithHTTPCode(http.StatusForbidden)
		return
	}
	return
}

func (handlers *Handlers) getSignature(request *http.Request) (signature []byte, err error) {
	signatureBase64 := request.Header.Get("x-square-hmacsha256-signature")
	signature, err = base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil {
		err = merry.Prepend(err, "error decoding signature").WithHTTPCode(http.StatusForbidden)
		return
	}
	if len(signature) != 32 {
		err = merry.New("signature is not 32 bytes long").WithHTTPCode(http.StatusForbidden)
		return
	}
	return
}

func (handlers *Handlers) getPayload(request *http.Request) (payload []byte, err error) {
	payload, err = ioutil.ReadAll(io.LimitReader(request.Body, 4*1012))
	if err != nil {
		err = merry.Prepend(err, "error reading request body").WithHTTPCode(http.StatusBadRequest)
		return
	}
	return
}

func (handlers *Handlers) getRequestURL(request *http.Request) string {
	return "https://" + request.Host + request.URL.String()
}
