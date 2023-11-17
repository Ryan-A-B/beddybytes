package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"

	"github.com/Ryan-A-B/baby-monitor/backend/internal"
	"github.com/Ryan-A-B/baby-monitor/backend/internal/eventlog"
	"github.com/Ryan-A-B/baby-monitor/backend/internal/store2"
	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

const EventTypeClientConnected = "client.connected"
const EventTypeClientDisconnected = "client.disconnected"

type ClientConnectedEventData struct {
	ClientID     string `json:"client_id"`
	ConnectionID string `json:"connection_id"`
}

type ClientDisconnectedEventData struct {
	ClientID           string `json:"client_id"`
	ConnectionID       string `json:"connection_id"`
	WebSocketCloseCode int    `json:"web_socket_close_code"`
}

type MessageType string

const (
	MessageTypeSignal MessageType = "signal"
	MessageTypeEvent  MessageType = "event"
)

type IncomingMessage struct {
	Type   MessageType     `json:"type"`
	Signal *IncomingSignal `json:"signal"`
}

func (message *IncomingMessage) Validate() (err error) {
	if message.Type != MessageTypeSignal {
		err = errors.New("invalid message type")
		return
	}
	if message.Signal == nil {
		err = errors.New("missing signal")
		return
	}
	return message.Signal.Validate()
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

type Event struct {
	ID            string          `json:"id"`
	Type          string          `json:"type"`
	LogicalClock  int             `json:"logical_clock"`
	UnixTimestamp int64           `json:"unix_timestamp"`
	Data          json.RawMessage `json:"data"`
}

type ConnectionStoreKey struct {
	AccountID    string
	ConnectionID string
}

func (handlers *Handlers) HandleConnection(responseWriter http.ResponseWriter, request *http.Request) {
	ctx := request.Context()
	accountID := internal.GetAccountIDFromContext(ctx)
	vars := mux.Vars(request)
	clientID := vars["client_id"]
	connectionID := vars["connection_id"]
	conn, err := handlers.Upgrader.Upgrade(responseWriter, request, nil)
	if err != nil {
		log.Println(err)
		return
	}
	defer conn.Close()
	handlers.EventLog.Append(ctx, &eventlog.AppendInput{
		Type:      EventTypeClientConnected,
		AccountID: accountID,
		Data: fatal.UnlessMarshalJSON(&ClientConnectedEventData{
			ClientID:     clientID,
			ConnectionID: connectionID,
		}),
	})
	webSocketCloseCode := websocket.CloseNoStatusReceived
	defer func() {
		handlers.EventLog.Append(ctx, &eventlog.AppendInput{
			Type:      EventTypeClientDisconnected,
			AccountID: accountID,
			Data: fatal.UnlessMarshalJSON(&ClientDisconnectedEventData{
				ClientID:           clientID,
				ConnectionID:       connectionID,
				WebSocketCloseCode: webSocketCloseCode,
			}),
		})
	}()
	connection := handlers.ConnectionFactory.CreateConnection(ctx, &CreateConnectionInput{
		AccountID:    accountID,
		ConnectionID: connectionID,
		conn:         conn,
	})
	iterator := handlers.EventLog.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
		// TODO update input to allow caller to explicitly specify starting from current cursor
		FromCursor: -1,
	})
	go connection.sendEvents(ctx, iterator)
	for {
		err = connection.handleNextMessage(ctx)
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
	}
	factory.ConnectionStore.Put(ctx, ConnectionStoreKey{
		AccountID:    input.AccountID,
		ConnectionID: input.ConnectionID,
	}, connection)
	return
}

type Connection struct {
	connectionStore store2.Store[ConnectionStoreKey, *Connection]
	AccountID       string
	ID              string
	conn            *websocket.Conn
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
		log.Println(err)
		return
	}
	other.conn.WriteJSON(OutgoingMessage{
		Type: MessageTypeSignal,
		Signal: &OutgoingSignal{
			FromConnectionID: connection.ID,
			Data:             signal.Data,
		},
	})
	return
}

func (connection *Connection) sendEvents(ctx context.Context, iterator eventlog.EventIterator) {
	accountID := internal.GetAccountIDFromContext(ctx)
	for iterator.Next() {
		event := iterator.Event()
		if event.AccountID != accountID {
			continue
		}
		connection.conn.WriteJSON(OutgoingMessage{
			Type: MessageTypeEvent,
			Event: &Event{
				ID:            event.ID,
				Type:          event.Type,
				LogicalClock:  event.LogicalClock,
				UnixTimestamp: event.UnixTimestamp,
				Data:          event.Data,
			},
		})
	}
	fatal.OnError(iterator.Err())
}
