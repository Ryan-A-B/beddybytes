package square

import (
	"io"
	"io/ioutil"
	"log"
	"net/http"

	"github.com/ansel1/merry"
)

type Handlers struct {
	SignatureKey string
}

func (handlers *Handlers) HandleWebhook(responseWriter http.ResponseWriter, request *http.Request) {
	payload, err := ioutil.ReadAll(io.LimitReader(request.Body, 4*1012))
	if err != nil {
		merry.Prepend(err, "error reading request body")
		log.Println(err)
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
