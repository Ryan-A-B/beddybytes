package square

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"io"
	"io/ioutil"
	"log"
	"net/http"

	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
	"github.com/ansel1/merry"
)

type Handlers struct {
	SignatureKey []byte
}

func (handlers *Handlers) HandleWebhook(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			log.Println(err)
		}
	}()
	signature, err := handlers.getSignature(request)
	if err != nil {
		return
	}
	payload, err := handlers.getPayload(request)
	if err != nil {
		return
	}
	hash := hmac.New(sha256.New, handlers.SignatureKey)
	requestURL := "https://" + request.Host + request.URL.String()
	_, err = io.WriteString(hash, requestURL)
	fatal.OnError(err)
	_, err = hash.Write(payload)
	fatal.OnError(err)
	sum := hash.Sum(nil)
	if !hmac.Equal(sum, signature) {
		err = merry.New("signature does not match").WithHTTPCode(http.StatusForbidden)
		return
	}
	log.Println("new webhook")
	log.Println("webhook payload: " + string(payload))
	for header, values := range request.Header {
		for _, value := range values {
			log.Println(header + ": " + value)
		}
	}
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
