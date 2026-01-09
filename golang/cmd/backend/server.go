package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/ansel1/merry"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/dgrijalva/jwt-go"
	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/accounts"
	"github.com/Ryan-A-B/beddybytes/golang/internal/babystationlist"
	"github.com/Ryan-A-B/beddybytes/golang/internal/connectionstore"
	"github.com/Ryan-A-B/beddybytes/golang/internal/connectionstoresync"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/logx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mailer"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mqttx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/resetpassword"
	"github.com/Ryan-A-B/beddybytes/golang/internal/sessionlist"
	"github.com/Ryan-A-B/beddybytes/golang/internal/sessionstore"
	"github.com/Ryan-A-B/beddybytes/golang/internal/store"
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
	SessionList       *sessionlist.SessionList
	BabyStationList   *babystationlist.BabyStationList
	EventLog          eventlog.EventLog
	MQTTClient        mqtt.Client
	UsageStats        *UsageStats

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
		httpx.Error(responseWriter, err)
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

func (handlers *Handlers) ListSessions(responseWriter http.ResponseWriter, request *http.Request) {
	ctx := request.Context()
	output := handlers.SessionList.List(ctx)
	err := json.NewEncoder(responseWriter).Encode(output)
	if err != nil {
		log.Panicln(err)
		return
	}
}

func (handlers *Handlers) GetBabyStationListSnapshot(responseWriter http.ResponseWriter, request *http.Request) {
	ctx := request.Context()
	output, err := handlers.BabyStationList.GetSnapshot(ctx)
	if err != nil {
		log.Panicln(err)
		return
	}
	err = json.NewEncoder(responseWriter).Encode(output)
	if err != nil {
		log.Panicln(err)
		return
	}
}

func (handlers *Handlers) GetKey(token *jwt.Token) (interface{}, error) {
	return handlers.Key, nil
}

func (handlers *Handlers) AddRoutes(router *mux.Router) {
	router.HandleFunc("/", handlers.Hello).Methods(http.MethodGet).Name("Hello")
	router.HandleFunc("/stats/total_hours", handlers.GetTotalHours).Methods(http.MethodGet).Name("GetTotalDuration")

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

	babyStationRouter := router.PathPrefix("/baby_station_list_snapshot").Subrouter()
	babyStationRouter.Use(internal.NewAuthorizationMiddleware(handlers.Key).Middleware)
	babyStationRouter.HandleFunc("", handlers.GetBabyStationListSnapshot).Methods(http.MethodGet).Name("GetBabyStationListSnapshot")
}

func main() {
	logx.SetFlags(log.LstdFlags | log.Llongfile)
	ctx := context.Background()
	key := []byte(internal.EnvStringOrFatal("ENCRYPTION_KEY"))
	cookieDomain := internal.EnvStringOrFatal("COOKIE_DOMAIN")
	eventLog := eventlog.NewThreadSafeDecorator(&eventlog.NewThreadSafeDecoratorInput{
		Decorated: eventlog.NewCachingDecoratorOrFatal(ctx, eventlog.NewCachingDecoratorInput{
			Decorated: eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
				FolderPath: internal.EnvStringOrFatal("FILE_EVENT_LOG_FOLDER_PATH"),
			}),
		}),
	})
	mqttClient := newMQTTClient()
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
		UsedTokens:                   accounts.NewUsedTokens(5 * time.Second),
		AnonymousAccessTokenDuration: 10 * time.Second,
		PasswordResetTokens: resetpassword.NewTokens(resetpassword.NewTokensInput{
			TTL: 15 * time.Minute,
		}),
		Mailer: newMailer(ctx),
	}
	go func() {
		eventlog.Project(ctx, eventlog.ProjectInput{
			EventLog:   accountHandlers.EventLog,
			FromCursor: 0,
			Apply:      accountHandlers.ApplyEvent,
		})
		log.Fatal("eventlog.Project exited")
	}()
	handlers := Handlers{
		Upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(request *http.Request) bool {
				return true
			},
		},
		ConnectionFactory: ConnectionFactory{},
		ClientStore: &LoggingDecorator{
			decorated: &LockingDecorator{
				decorated: &ClientStoreInMemory{
					clientsByAccountID: make(map[string]map[string]*Client),
				},
			},
		},
		SessionProjection: SessionProjection{
			SessionStore: sessionstore.NewThreadSafeDecorator(&sessionstore.NewThreadSafeDecoratorInput{
				Decorated: new(sessionstore.InMemory),
			}),
		},
		SessionList: sessionlist.New(ctx, sessionlist.NewInput{
			Log: eventLog,
		}),
		BabyStationList: babystationlist.New(babystationlist.NewInput{
			EventLog: eventLog,
		}),
		EventLog:   eventLog,
		MQTTClient: mqttClient,
		UsageStats: NewUsageStats(ctx, NewUsageStatsInput{
			Log: eventLog,
		}),
		Key: key,
	}
	go func() {
		eventlog.Project(ctx, eventlog.ProjectInput{
			EventLog:   handlers.EventLog,
			FromCursor: 0,
			Apply:      handlers.SessionProjection.ApplyEvent,
		})
		log.Fatal("eventlog.Project exited")
	}()
	go func() {
		connectionstoresync.Run(ctx, connectionstoresync.RunInput{
			MQTTClient: mqttClient,
			ConnectionStore: connectionstore.NewDecider(connectionstore.NewDeciderInput{
				EventLog: eventLog,
			}),
		})
		log.Fatal("connectionstoresync.Run exited")
	}()
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

func appendServerStartedEvent(ctx context.Context, eventLog eventlog.EventLog) {
	_, err := eventLog.Append(ctx, eventlog.AppendInput{
		Type: EventTypeServerStarted,
		Data: fatal.UnlessMarshalJSON(nil),
	})
	fatal.OnError(err)
}

func newMailer(ctx context.Context) accounts.Mailer {
	implementation := internal.EnvStringOrFatal("MAILER_IMPLEMENTATION")
	switch implementation {
	case "console":
		return mailer.NewConsoleMailer(mailer.NewConsoleMailerInput{
			AppHost: internal.EnvStringOrFatal("MAILER_CONSOLE_APP_HOST"),
		})
	case "ses":
		cfg, err := config.LoadDefaultConfig(ctx)
		fatal.OnError(err)
		return mailer.NewSESMailer(mailer.NewSESMailerInput{
			AWSConfig: cfg,
			From:      internal.EnvStringOrFatal("MAILER_SES_FROM"),
			AppHost:   internal.EnvStringOrFatal("MAILER_SES_APP_HOST"),
		})
	default:
		panic("invalid MAILER_IMPLEMENTATION")
	}
}

func newMQTTClient() (client mqtt.Client) {
	broker := internal.EnvStringOrFatal("MQTT_BROKER")
	clientID := internal.EnvStringOrFatal("MQTT_CLIENT_ID")
	options := mqtt.NewClientOptions()
	options.AddBroker(broker)
	options.SetClientID(clientID)
	options.SetResumeSubs(true)
	options.SetCleanSession(false)
	options.SetKeepAlive(60 * time.Second)
	options.SetPingTimeout(10 * time.Second)
	options.OnConnect = func(client mqtt.Client) {
		log.Println("Connected to broker")
	}
	options.OnConnectionLost = func(client mqtt.Client, err error) {
		log.Println("Connection lost:", err)
	}
	implementation := internal.EnvStringOrFatal("MQTT_IMPLEMENTATION")
	switch implementation {
	case "mosquitto":
		options.SetTLSConfig(&tls.Config{
			InsecureSkipVerify: true,
		})
	case "aws_iot":
		rootCAFile := internal.EnvStringOrFatal("MQTT_AWS_IOT_ROOT_CA_FILE")
		certFile := internal.EnvStringOrFatal("MQTT_AWS_IOT_CERT_FILE")
		keyFile := internal.EnvStringOrFatal("MQTT_AWS_IOT_KEY_FILE")
		rootCA, err := os.ReadFile(rootCAFile)
		fatal.OnError(err)
		rootCAs := x509.NewCertPool()
		ok := rootCAs.AppendCertsFromPEM(rootCA)
		fatal.Unless(ok, "failed to append root CA certificate")
		cert, err := tls.LoadX509KeyPair(certFile, keyFile)
		fatal.OnError(err)
		tlsConfig := tls.Config{
			RootCAs:            rootCAs,
			Certificates:       []tls.Certificate{cert},
			MinVersion:         tls.VersionTLS12,
			InsecureSkipVerify: false,
		}
		options.SetTLSConfig(&tlsConfig)
	default:
		panic("invalid MQTT_IMPLEMENTATION")
	}
	client = mqtt.NewClient(options)
	err := mqttx.Wait(client.Connect())
	fatal.OnError(err)
	return
}
