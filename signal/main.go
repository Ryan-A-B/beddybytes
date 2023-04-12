package main

import (
	"crypto/tls"
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

type MessageType string

const (
	MessageTypeRegister MessageType = "register"
	MessageTypeData     MessageType = "data"
)

type MessageFrame struct {
	Type     MessageType     `json:"type"`
	Register *PutClientInput `json:"register,omitempty"`
	Data     json.RawMessage `json:"data"`
}

type IncomingMessageFrame struct {
	MessageFrame
	ToPeerID string `json:"to_peer_id"`
}

type OutgoingMessageFrame struct {
	MessageFrame
	FromPeerID string `json:"from_peer_id"`
}

type Client struct {
	ID       string
	PeerIDs  []string
	messageC chan []byte
}

type Handlers struct {
	Upgrader    websocket.Upgrader
	ClientStore ClientStore
}

func (handlers *Handlers) HandleWebsocket(responseWriter http.ResponseWriter, request *http.Request) {
	conn, err := handlers.Upgrader.Upgrade(responseWriter, request, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer conn.Close()
	client, err := handlers.RegisterClient(conn)
	if err != nil {
		log.Println(err)
		return
	}
	defer handlers.ClientStore.Remove(client.ID)
	go handlers.processIncomingMessages(conn, client)
	for message := range client.messageC {
		err := conn.WriteMessage(websocket.TextMessage, message)
		if err != nil {
			log.Println(err)
			return
		}
	}
}

func (handlers *Handlers) RegisterClient(conn *websocket.Conn) (client *Client, err error) {
	var messageFrame MessageFrame
	err = conn.ReadJSON(&messageFrame)
	if err != nil {
		return
	}
	if messageFrame.Type != MessageTypeRegister {
		err = errors.New("expected register message")
		return
	}
	client = handlers.ClientStore.Put(*messageFrame.Register)
	return
}

func (handlers *Handlers) LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		log.Println(request.URL.Path, request.Method)
		next.ServeHTTP(responseWriter, request)
	})
}

func (handlers *Handlers) AddRoutes(router *mux.Router) {
	router.Use(handlers.LoggingMiddleware)
	router.HandleFunc("/ws", handlers.HandleWebsocket).Methods(http.MethodGet).Name("HandleWebsocket")
}

func (handlers *Handlers) processIncomingMessages(conn *websocket.Conn, client *Client) {
	var err error
	for {
		var incomingMessageFrame IncomingMessageFrame
		err = conn.ReadJSON(&incomingMessageFrame)
		if err != nil {
			log.Println(err)
			return
		}
		if incomingMessageFrame.Type != MessageTypeData {
			log.Println("expected data message")
			return
		}
		peer := handlers.ClientStore.Get(incomingMessageFrame.ToPeerID)
		if peer == nil {
			log.Println("client not found")
			return
		}
		if !contains(peer.PeerIDs, client.ID) {
			log.Println("client not a peer")
			return
		}
		outgoingMessageFrame := OutgoingMessageFrame{
			MessageFrame: incomingMessageFrame.MessageFrame,
			FromPeerID:   client.ID,
		}
		message, err := json.Marshal(outgoingMessageFrame)
		if err != nil {
			log.Println(err)
			return
		}
		peer.messageC <- message
	}
}

func contains(slice []string, item string) bool {
	for _, i := range slice {
		if i == item {
			return true
		}
	}
	return false
}

func main() {
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
					clients: make(map[string]*Client),
				},
			},
		},
	}
	router := mux.NewRouter()
	handlers.AddRoutes(router)
	certificate, err := tls.LoadX509KeyPair("server.crt", "server.key")
	if err != nil {
		panic(err)
	}
	server := http.Server{
		Addr:    ":8000",
		Handler: router,
		TLSConfig: &tls.Config{
			Certificates: []tls.Certificate{certificate},
		},
	}
	log.Fatal(server.ListenAndServeTLS("", ""))
}
