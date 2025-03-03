package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/store2"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	uuid "github.com/satori/go.uuid"
)

const EventTypeClientConnected = "client.connected"
const EventTypeClientDisconnected = "client.disconnected"

type ClientConnectedEventData struct {
	ClientID     string `json:"client_id"`
	ConnectionID string `json:"connection_id"`
	RequestID    string `json:"request_id"`
}

type ClientDisconnectedEventData struct {
	ClientID           string `json:"client_id"`
	ConnectionID       string `json:"connection_id"`
	RequestID          string `json:"request_id"`
	WebSocketCloseCode int    `json:"web_socket_close_code"`
}

type MessageType string

const (
	MessageTypePing   MessageType = "ping"
	MessageTypePong   MessageType = "pong"
	MessageTypeSignal MessageType = "signal"
)

type IncomingMessage struct {
	Type   MessageType     `json:"type"`
	Signal *IncomingSignal `json:"signal"`
}

func (message *IncomingMessage) Validate() (err error) {
	switch message.Type {
	case MessageTypePing:
		return
	case MessageTypeSignal:
		if message.Signal == nil {
			err = errors.New("missing signal")
			return
		}
		return message.Signal.Validate()
	default:
		err = errors.New("invalid message type")
		return
	}
}

type IncomingSignal struct {
	ToConnectionID string          `json:"to_connection_id"`
	Data           json.RawMessage `json:"data"`
}

func (signal *IncomingSignal) Validate() (err error) {
	if signal.ToConnectionID == "" {
		err = errors.New("missing to_connection_id")
		return
	}
	if signal.Data == nil {
		err = errors.New("missing data")
		return
	}
	return
}

type OutgoingMessage struct {
	Type   MessageType     `json:"type"`
	Signal *OutgoingSignal `json:"signal,omitempty"`
	Event  *Event          `json:"event,omitempty"`
}

type OutgoingSignal struct {
	FromConnectionID string          `json:"from_connection_id"`
	Data             json.RawMessage `json:"data"`
}

type ConnectionStoreKey struct {
	AccountID    string
	ConnectionID string
}

func (handlers *Handlers) HandleConnection(responseWriter http.ResponseWriter, request *http.Request) {
	ctx := request.Context()
	accountID := contextx.GetAccountID(ctx)
	vars := mux.Vars(request)
	clientID := vars["client_id"]
	connectionID := vars["connection_id"]
	conn, err := handlers.Upgrader.Upgrade(responseWriter, request, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer conn.Close()
	requestID := uuid.NewV4().String()
	// TODO this is causing a delay
	_, err = handlers.EventLog.Append(ctx, eventlog.AppendInput{
		Type:      EventTypeClientConnected,
		AccountID: accountID,
		Data: fatal.UnlessMarshalJSON(&ClientConnectedEventData{
			ClientID:     clientID,
			ConnectionID: connectionID,
			RequestID:    requestID,
		}),
	})
	fatal.OnError(err)
	webSocketCloseCode := websocket.CloseNoStatusReceived
	defer func() {
		_, err = handlers.EventLog.Append(ctx, eventlog.AppendInput{
			Type:      EventTypeClientDisconnected,
			AccountID: accountID,
			Data: fatal.UnlessMarshalJSON(&ClientDisconnectedEventData{
				ClientID:           clientID,
				ConnectionID:       connectionID,
				RequestID:          requestID,
				WebSocketCloseCode: webSocketCloseCode,
			}),
		})
		fatal.OnError(err)
	}()
	connection := handlers.ConnectionFactory.CreateConnection(ctx, &CreateConnectionInput{
		AccountID:    accountID,
		ConnectionID: connectionID,
		conn:         conn,
	})
	errC := make(chan error, 1)
	go func() {
		errC <- connection.runKeepAlive(ctx)
	}()
	go func() {
		errC <- connection.handleMessages(ctx)
	}()
	select {
	case <-ctx.Done():
		return
	case err = <-errC:
		if err != nil {
			if closeError, ok := err.(*websocket.CloseError); ok {
				webSocketCloseCode = closeError.Code
				if closeError.Code == websocket.CloseNormalClosure {
					return
				}
			}
			log.Println(err)
			return
		}
	}
}

type ConnectionFactory struct {
	ConnectionStore store2.Store[ConnectionStoreKey, *Connection]
}

type CreateConnectionInput struct {
	AccountID    string
	ConnectionID string
	conn         *websocket.Conn
}

func (factory *ConnectionFactory) CreateConnection(ctx context.Context, input *CreateConnectionInput) (connection *Connection) {
	connection = &Connection{
		connectionStore: factory.ConnectionStore,
		AccountID:       input.AccountID,
		ID:              input.ConnectionID,
		conn:            input.conn,
		pongC:           make(chan struct{}),
	}
	connection.conn.SetPongHandler(connection.handlePong)
	err := factory.ConnectionStore.Put(ctx, ConnectionStoreKey{
		AccountID:    input.AccountID,
		ConnectionID: input.ConnectionID,
	}, connection)
	fatal.OnError(err)
	return
}

type Connection struct {
	connectionStore store2.Store[ConnectionStoreKey, *Connection]
	AccountID       string
	ID              string
	mutex           sync.Mutex
	conn            *websocket.Conn
	pongC           chan struct{}
}

func (connection *Connection) handleMessages(ctx context.Context) (err error) {
	for {
		select {
		case <-ctx.Done():
			return
		default:
			err = connection.handleNextMessage(ctx)
			if err != nil {
				return
			}
		}
	}
}

func (connection *Connection) handleNextMessage(ctx context.Context) (err error) {
	var incomingMessage IncomingMessage
	err = connection.conn.ReadJSON(&incomingMessage)
	if err != nil {
		return
	}
	err = incomingMessage.Validate()
	if err != nil {
		return
	}
	switch incomingMessage.Type {
	case MessageTypePing:
		return connection.conn.WriteJSON(OutgoingMessage{
			Type: MessageTypePong,
		})
	case MessageTypeSignal:
		return connection.handleSignal(ctx, incomingMessage.Signal)
	default:
		return errors.New("unhandled message type: " + string(incomingMessage.Type))
	}
}

func (connection *Connection) handleSignal(ctx context.Context, signal *IncomingSignal) (err error) {
	other, err := connection.connectionStore.Get(ctx, ConnectionStoreKey{
		AccountID:    connection.AccountID,
		ConnectionID: signal.ToConnectionID,
	})
	if err != nil {
		// TODO return error in the 4000-4999 range
		log.Println(err)
		return
	}
	other.mutex.Lock()
	defer other.mutex.Unlock()
	other.conn.WriteJSON(OutgoingMessage{
		Type: MessageTypeSignal,
		Signal: &OutgoingSignal{
			FromConnectionID: connection.ID,
			Data:             signal.Data,
		},
	})
	return
}

func (connection *Connection) handlePong(appData string) (err error) {
	select {
	case connection.pongC <- struct{}{}:
	default:
		log.Println("unexpected pong")
	}
	return
}

func (connection *Connection) runKeepAlive(ctx context.Context) (err error) {
	const pingPeriod = 30 * time.Second
	ticker := time.NewTicker(pingPeriod)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			err = connection.pingPong(ctx)
			if err != nil {
				return
			}
		}
	}
}

func (connection *Connection) pingPong(ctx context.Context) (err error) {
	err = connection.sendPing(ctx)
	if err != nil {
		return
	}
	err = connection.waitForPong(ctx)
	if err != nil {
		return
	}
	return
}

func (connection *Connection) sendPing(ctx context.Context) (err error) {
	const pingWriteTimeout = 10 * time.Second
	deadline := time.Now().Add(pingWriteTimeout)
	err = connection.conn.WriteControl(websocket.PingMessage, nil, deadline)
	if err != nil {
		return
	}
	return
}

func (connection *Connection) waitForPong(ctx context.Context) (err error) {
	const pongReadTimeout = 10 * time.Second
	select {
	case <-ctx.Done():
		return
	case <-time.After(pongReadTimeout):
		return errors.New("pong timeout")
	case <-connection.pongC:
		return
	}
}
