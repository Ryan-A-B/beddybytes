package square

import (
	"io"
	"io/ioutil"
	"log"
	"net/http"

	"github.com/ansel1/merry"
)

type Handlers struct {
}

func (handlers *Handlers) HandleWebhook(responseWriter http.ResponseWriter, request *http.Request) {
	payload, err := ioutil.ReadAll(io.LimitReader(request.Body, 4*1012))
	if err != nil {
		merry.Prepend(err, "error reading request body")
		log.Println(err)
		return
	}
	log.Println("webhook payload: " + string(payload))
}
