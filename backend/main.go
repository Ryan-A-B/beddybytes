package main

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
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

	Key []byte
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

func (handlers *Handlers) LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		log.Println(request.URL.Path, request.Method)
		next.ServeHTTP(responseWriter, request)
	})
}

func (handlers *Handlers) CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		responseWriter.Header().Set("Access-Control-Allow-Origin", "*")
		responseWriter.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		responseWriter.Header().Set("Access-Control-Allow-Headers", "Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With")
		next.ServeHTTP(responseWriter, request)
	})
}

func (handlers *Handlers) MockAuthorizationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		ctx := request.Context()
		ctx = internal.ContextWithAccountID(ctx, "account_id")
		next.ServeHTTP(responseWriter, request.Clone(ctx))
	})
}

func (handlers *Handlers) AddRoutes(router *mux.Router) {
	router.Use(handlers.CORSMiddleware)
	router.Use(handlers.LoggingMiddleware)
	router.HandleFunc("/", handlers.Hello).Methods(http.MethodGet).Name("Hello")
	clientRouter := router.PathPrefix("/clients").Subrouter()
	// TODO clientRouter.Use(authenticatedRouter.Use(internal.NewAuthorizationMiddleware(handlers.Key).Middleware))
	clientRouter.Use(handlers.MockAuthorizationMiddleware)
	clientRouter.HandleFunc("", handlers.ListClients).Methods(http.MethodGet).Name("ListClients")
	clientRouter.HandleFunc("/{client_id}/websocket", handlers.HandleWebsocket).Methods(http.MethodGet).Name("HandleWebsocket")
}

func generateKey() (key []byte) {
	key = make([]byte, 32)
	_, err := io.ReadFull(rand.Reader, key)
	fatal.OnError(err)
	return
}

func main() {
	key := generateKey()
	accountHandlers := accounts.Handlers{
		AccountStore:        accounts.NewAccountStoreInMemory(),
		SigningMethod:       jwt.SigningMethodHS256,
		Key:                 key,
		AccessTokenDuration: 1 * time.Hour,
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
	handlers.AddRoutes(router)
	accountHandlers.AddRoutes(router)
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
