package main

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/ansel1/merry"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/ryan/baby-monitor/backend/accounts"
	"github.com/ryan/baby-monitor/backend/internal"
	"github.com/ryan/baby-monitor/backend/internal/fatal"
)

type IncomingMessageFrame struct {
	ToPeerID string          `json:"to_peer_id"`
	Data     json.RawMessage `json:"data"`
}

type OutgoingMessageFrame struct {
	FromPeerID string          `json:"from_peer_id"`
	Data       json.RawMessage `json:"data"`
}

type ClientType string

const (
	ClientTypeCamera  ClientType = "camera"
	ClientTypeMonitor ClientType = "monitor"
)

var stringToClientType = map[string]ClientType{
	string(ClientTypeCamera):  ClientTypeCamera,
	string(ClientTypeMonitor): ClientTypeMonitor,
}

type Client struct {
	ID       string     `json:"id"`
	Type     ClientType `json:"type"`
	Alias    string     `json:"alias"`
	messageC chan []byte
}

type Handlers struct {
	Upgrader    websocket.Upgrader
	ClientStore ClientStore

	Key interface{}
}

func (handlers *Handlers) Hello(responseWriter http.ResponseWriter, request *http.Request) {
	responseWriter.Write([]byte("Hello"))
}

func (handlers *Handlers) HandleWebsocket(responseWriter http.ResponseWriter, request *http.Request) {
	ctx := request.Context()
	vars := mux.Vars(request)
	clientID := vars["client_id"]
	clientType, ok := stringToClientType[request.FormValue("client_type")]
	if !ok {
		err := merry.Errorf("invalid client_type: %s", request.FormValue("client_type")).WithHTTPCode(http.StatusBadRequest)
		http.Error(responseWriter, err.Error(), merry.HTTPCode(err))
		return
	}
	clientAlias := request.FormValue("client_alias")
	conn, err := handlers.Upgrader.Upgrade(responseWriter, request, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer conn.Close()
	client := handlers.ClientStore.Put(ctx, PutClientInput{
		ID:    clientID,
		Type:  clientType,
		Alias: clientAlias,
	})
	defer handlers.ClientStore.Remove(ctx, client.ID)
	go handlers.processIncomingMessages(ctx, conn, client)
	for message := range client.messageC {
		err := conn.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			log.Println(err)
			return
		}
	}
}

func (handlers *Handlers) processIncomingMessages(ctx context.Context, conn *websocket.Conn, client *Client) {
	var err error
	defer func() {
		close(client.messageC)
		if err != nil {
			log.Println(err)
		}
	}()
	for {
		var incomingMessageFrame IncomingMessageFrame
		err = conn.ReadJSON(&incomingMessageFrame)
		if err != nil {
			return
		}
		peer := handlers.ClientStore.Get(ctx, incomingMessageFrame.ToPeerID)
		if peer == nil {
			err = errors.New("client not found")
			return
		}
		outgoingMessageFrame := OutgoingMessageFrame{
			FromPeerID: client.ID,
			Data:       incomingMessageFrame.Data,
		}
		message, err := json.Marshal(outgoingMessageFrame)
		if err != nil {
			return
		}
		peer.messageC <- message
	}
}

func (handlers *Handlers) ListClients(responseWriter http.ResponseWriter, request *http.Request) {
	ctx := request.Context()
	clients := handlers.ClientStore.List(ctx)
	if clients == nil {
		clients = []*Client{}
	}
	err := json.NewEncoder(responseWriter).Encode(clients)
	if err != nil {
		log.Println(err)
		return
	}
}

func (handlers *Handlers) GetKey(token *jwt.Token) (interface{}, error) {
	return handlers.Key, nil
}

func (handlers *Handlers) AddRoutes(router *mux.Router) {
	router.Use(internal.LoggingMiddleware)
	router.Use(mux.CORSMethodMiddleware(router))
	router.Use(internal.CORSMiddleware)
	router.HandleFunc("/", handlers.Hello).Methods(http.MethodGet).Name("Hello")
	clientRouter := router.PathPrefix("/clients").Subrouter()
	clientRouter.Use(internal.NewAuthorizationMiddleware(handlers.Key).Middleware)
	clientRouter.HandleFunc("", handlers.ListClients).Methods(http.MethodGet, http.MethodOptions).Name("ListClients")
	clientRouter.HandleFunc("/{client_id}/websocket", handlers.HandleWebsocket).Methods(http.MethodGet, http.MethodOptions).Name("HandleWebsocket")
}

func getOrCreateKey() (key interface{}) {
	key, ok := getKey()
	if !ok {
		key = createKey()
	}
	return
}

func getKey() (key interface{}, ok bool) {
	data, err := ioutil.ReadFile("key.pem")
	switch {
	case err == nil:
		block, _ := pem.Decode(data)
		fatal.Unless(block != nil, "invalid key")
		privateKey, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		fatal.OnError(err)
		return privateKey, true
	case os.IsNotExist(err):
		return nil, false
	default:
		fatal.OnError(err)
		return
	}
}

func createKey() interface{} {
	file, err := os.Create("key.pem")
	fatal.OnError(err)
	defer file.Close()
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	fatal.OnError(err)
	err = pem.Encode(file, &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(privateKey),
	})
	fatal.OnError(err)
	return privateKey
}

func main() {
	key := getOrCreateKey()
	accountHandlers := accounts.Handlers{
		AccountStore:         accounts.NewAccountStoreFileSystem("account_store"),
		SigningMethod:        jwt.SigningMethodRS256,
		Key:                  key,
		AccessTokenDuration:  1 * time.Hour,
		RefreshTokenDuration: 7 * 24 * time.Hour,
		UsedRefreshTokens:    accounts.NewUsedRefreshTokens(),
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
	certificate, err := tls.LoadX509KeyPair("server.crt", "server.key")
	fatal.OnError(err)
	server := http.Server{
		Addr:    ":8000",
		Handler: router,
		TLSConfig: &tls.Config{
			Certificates: []tls.Certificate{certificate},
		},
	}
	log.Fatal(server.ListenAndServeTLS("", ""))
}
