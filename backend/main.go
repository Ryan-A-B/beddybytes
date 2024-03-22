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
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/dgrijalva/jwt-go"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"

	"github.com/Ryan-A-B/beddybytes/backend/accounts"
	"github.com/Ryan-A-B/beddybytes/backend/internal"
	"github.com/Ryan-A-B/beddybytes/backend/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/backend/internal/sendemail"
	"github.com/Ryan-A-B/beddybytes/backend/internal/store"
	"github.com/Ryan-A-B/beddybytes/backend/internal/store2"
	"github.com/Ryan-A-B/beddybytes/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/internal/square"
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
	Upgrader          websocket.Upgrader
	ClientStore       ClientStore
	ConnectionFactory ConnectionFactory
	SessionProjection SessionProjection
	EventLog          eventlog.EventLog

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
		log.Println("Warn: ", err)
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
	router.HandleFunc("/", handlers.Hello).Methods(http.MethodGet).Name("Hello")
	clientRouter := router.PathPrefix("/clients").Subrouter()
	clientRouter.Use(internal.NewAuthorizationMiddleware(handlers.Key).Middleware)
	clientRouter.HandleFunc("", handlers.ListClients).Methods(http.MethodGet).Name("ListClients")
	clientRouter.HandleFunc("/{client_id}/websocket", handlers.HandleWebsocket).Methods(http.MethodGet).Name("HandleWebsocket")
	clientRouter.HandleFunc("/{client_id}/connections/{connection_id}", handlers.HandleConnection).Methods(http.MethodGet).Name("HandleConnection")

	sessionRouter := router.PathPrefix("/sessions").Subrouter()
	sessionRouter.Use(internal.NewAuthorizationMiddleware(handlers.Key).Middleware)
	sessionRouter.HandleFunc("", handlers.ListSessions).Methods(http.MethodGet).Name("ListSessions")
	sessionRouter.HandleFunc("/{session_id}", handlers.StartSession).Methods(http.MethodPut).Name("StartSession")
	sessionRouter.HandleFunc("/{session_id}", handlers.EndSession).Methods(http.MethodDelete).Name("EndSession")

	eventsRouter := router.PathPrefix("/events").Subrouter()
	eventsRouter.Use(internal.NewAuthorizationMiddleware(handlers.Key).Middleware)
	eventsRouter.HandleFunc("", handlers.GetEvents).Methods(http.MethodGet).Name("GetEvents")
}

func main() {
	ctx := context.Background()
	key := []byte(internal.EnvStringOrFatal("ENCRYPTION_KEY"))
	cookieDomain := internal.EnvStringOrFatal("COOKIE_DOMAIN")
	eventLog := newEventLog(ctx)
	go runMailer(ctx, eventLog)
	accountHandlers := accounts.Handlers{
		CookieDomain: cookieDomain,
		EventLog:     eventLog,
		AccountStore: &accounts.AccountStore{
			Store: store.NewMemoryStore(),
		},
		SigningMethod:                jwt.SigningMethodHS256,
		Key:                          key,
		AccessTokenDuration:          1 * time.Hour,
		RefreshTokenDuration:         30 * 24 * time.Hour,
		UsedTokens:                   accounts.NewUsedTokens(),
		AnonymousAccessTokenDuration: 10 * time.Second,

		SignatureKey: []byte(internal.EnvStringOrFatal("SQUARE_SIGNATURE_KEY")),

		Client:     newSquareClient(),
		LocationID: internal.EnvStringOrFatal("SQUARE_LOCATION_ID"),
	}
	go eventlog.Project(ctx, &eventlog.ProjectInput{
		EventLog:   accountHandlers.EventLog,
		FromCursor: 0,
		Apply:      accountHandlers.ApplyEvent,
	})
	handlers := Handlers{
		Upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(request *http.Request) bool {
				return true
			},
		},
		ConnectionFactory: ConnectionFactory{
			// TODO either not in memory or reproject from event log on startup
			ConnectionStore: make(store2.StoreInMemory[ConnectionStoreKey, *Connection]),
		},
		ClientStore: &LoggingDecorator{
			decorated: &LockingDecorator{
				decorated: &ClientStoreInMemory{
					clientsByAccountID: make(map[string]map[string]*Client),
				},
			},
		},
		SessionProjection: SessionProjection{
			SessionStore: NewThreadSafeDecorator(&NewThreadSafeDecoratorInput{
				Decorated: new(SessionStoreInMemory),
			}),
		},
		EventLog: eventLog,
		Key:      key,
	}
	go eventlog.Project(ctx, &eventlog.ProjectInput{
		EventLog:   handlers.EventLog,
		FromCursor: 0,
		Apply:      handlers.SessionProjection.ApplyEvent,
	})
	router := mux.NewRouter()
	router.Use(internal.LoggingMiddleware)
	handlers.AddRoutes(router.NewRoute().Subrouter())
	accountHandlers.AddRoutes(router.NewRoute().Subrouter())
	addr := internal.EnvStringOrFatal("SERVER_ADDR")
	server := http.Server{
		Addr:    addr,
		Handler: router,
	}
	appendServerStartedEvent(ctx, eventLog)
	fmt.Printf("Listening on %s\n", addr)
	log.Fatal(server.ListenAndServe())
}

func newEventLog(ctx context.Context) eventlog.EventLog {
	return eventlog.NewThreadSafeDecorator(&eventlog.NewThreadSafeDecoratorInput{
		Decorated: eventlog.NewFollowingDecorator(&eventlog.NewFollowingDecoratorInput{
			Decorated: eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
				FolderPath: internal.EnvStringOrFatal("FILE_EVENT_LOG_FOLDER_PATH"),
			}),
			BufferSize: 32,
		}),
	})
}

func appendServerStartedEvent(ctx context.Context, eventLog eventlog.EventLog) {
	_, err := eventLog.Append(ctx, &eventlog.AppendInput{
		Type: EventTypeServerStarted,
		Data: fatal.UnlessMarshalJSON(nil),
	})
	fatal.OnError(err)
}

func newSquareClient() *square.Client {
	return square.NewClient(&square.NewClientInput{
		HTTPClient:    http.DefaultClient,
		Scheme:        internal.EnvStringOrFatal("SQUARE_SCHEME"),
		Host:          internal.EnvStringOrFatal("SQUARE_HOST"),
		ApplicationID: internal.EnvStringOrFatal("SQUARE_APPLICATION_ID"),
		AccessToken:   internal.EnvStringOrFatal("SQUARE_ACCESS_TOKEN"),
	})
}

func runMailer(ctx context.Context, eventLog eventlog.EventLog) {
	fromEmailAddress := internal.EnvStringOrFatal("FROM_EMAIL_ADDRESS")
	input := NewMailerInput{
		EventLog:              eventLog,
		FromEmailAddress:      fromEmailAddress,
		EmailDeferralDuration: 10 * time.Second,
	}
	strategyName := internal.EnvStringOrFatal("SEND_EMAIL_STRATEGY")
	switch strategyName {
	case "null":
		input.SendEmail = func(ctx context.Context, input sendemail.SendEmailInput) (messageID string) {
			log.Println("Would send email to " + input.EmailAddress)
			return
		}
	case "ses":
		config, err := awsconfig.LoadDefaultConfig(ctx, awsconfig.WithRegion(internal.EnvStringOrFatal("AWS_REGION")))
		fatal.OnError(err)
		strategy := sendemail.NewSendEmailUsingSESStrategy(&sendemail.NewSendEmailUsingSESStrategyInput{
			Client:                      sesv2.NewFromConfig(config),
			FromEmailAddress:            fromEmailAddress,
			FromEmailAddressIdentityARN: internal.EnvStringOrFatal("SEND_EMAIL_USING_SES_FROM_EMAIL_ADDRESS_IDENTITY_ARN"),
		})
		input.SendEmail = strategy.SendEmail
	default:
		log.Fatal("invalid SEND_EMAIL_STRATEGY: ", strategyName)
	}

	mailer := NewMailer(&input)
	mailer.Run(ctx)
}
