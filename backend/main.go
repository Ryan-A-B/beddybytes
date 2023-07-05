package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/ansel1/merry"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"

	"github.com/Ryan-A-B/baby-monitor/backend/accounts"
	"github.com/Ryan-A-B/baby-monitor/backend/internal"
	"github.com/Ryan-A-B/baby-monitor/backend/internal/fatal"
	"github.com/Ryan-A-B/baby-monitor/backend/internal/store"
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
	router.Use(internal.SkipOptionsMiddleware)
	router.HandleFunc("/", handlers.Hello).Methods(http.MethodGet).Name("Hello")
	clientRouter := router.PathPrefix("/clients").Subrouter()
	clientRouter.Use(internal.NewAuthorizationMiddleware(handlers.Key).Middleware)
	clientRouter.HandleFunc("", handlers.ListClients).Methods(http.MethodGet, http.MethodOptions).Name("ListClients")
	clientRouter.HandleFunc("/{client_id}/websocket", handlers.HandleWebsocket).Methods(http.MethodGet, http.MethodOptions).Name("HandleWebsocket")
}

func main() {
	ctx := context.Background()
	key := []byte(internal.EnvStringOrFatal("ENCRYPTION_KEY"))
	frontendURL := internal.EnvURLOrFatal("APP_URL")
	accountHandlers := accounts.Handlers{
		FrontendURL:                  frontendURL,
		AccountStore:                 newAccountStore(ctx, key),
		SigningMethod:                jwt.SigningMethodHS256,
		Key:                          key,
		AccessTokenDuration:          1 * time.Hour,
		RefreshTokenDuration:         30 * 24 * time.Hour,
		UsedTokens:                   accounts.NewUsedTokens(),
		AnonymousAccessTokenDuration: 10 * time.Second,
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
	addr := internal.EnvStringOrFatal("SERVER_ADDR")
	server := http.Server{
		Addr:    addr,
		Handler: router,
	}
	fmt.Printf("Listening on %s\n", addr)
	log.Fatal(server.ListenAndServe())
}

func newAccountStore(ctx context.Context, key []byte) *accounts.AccountStore {
	var s store.Store
	switch internal.EnvStringOrDefault("ACCOUNT_STORE_IMPLEMENTATION", "file_system") {
	case "file_system":
		s = store.NewFileSystemStore(&store.NewFileSystemStoreInput{
			Root: "account_store",
		})
	case "s3":
		region := internal.EnvStringOrFatal("ACCOUNT_STORE_S3_REGION")
		config, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(region))
		fatal.OnError(err)
		s = store.NewS3Store(&store.NewS3StoreInput{
			Client: s3.NewFromConfig(config),
			Bucket: internal.EnvStringOrFatal("ACCOUNT_STORE_S3_BUCKET"),
			Prefix: "account_store/",
		})
	default:
		fatal.OnError(errors.New("unknown account store implementation"))
	}
	return &accounts.AccountStore{
		Store: store.NewCachingDecorator(&store.NewCachingDecoratorInput{
			Store: store.NewEncryptingDecorator(&store.NewEncryptingDecoratorInput{
				Store: s,
				Key:   key,
			}),
		}),
	}
}
