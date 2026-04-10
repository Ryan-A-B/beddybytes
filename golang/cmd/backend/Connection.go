package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"

	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/logx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mqttx"
)

const webrtcInboxTopicFormat = "accounts/%s/clients/%s/webrtc_inbox"
const statusTopicFormat = "accounts/%s/clients/%s/status"

const EventTypeClientConnected = "client.connected"
const EventTypeClientDisconnected = "client.disconnected"

type ClientConnectedEventData struct {
	ClientID     string `json:"client_id"`
	ConnectionID string `json:"connection_id"`
	RequestID    string `json:"request_id"`
	AtMillis     int64  `json:"at_millis"`
}

type ClientDisconnectedEventData struct {
	ClientID           string `json:"client_id"`
	ConnectionID       string `json:"connection_id"`
	RequestID          string `json:"request_id"`
	WebSocketCloseCode int    `json:"web_socket_close_code"`
	AtMillis           int64  `json:"at_millis"`
	Disconnected struct {
		Reason string `json:"reason"`
	} `json:"disconnected"`
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
	ToClientID     string          `json:"to_client_id,omitempty"`
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
	Signal json.RawMessage `json:"signal,omitempty"`
	Event  *Event          `json:"event,omitempty"`
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
		logx.Errorln(err)
		return
	}
	defer conn.Close()
	err = handlers.sendConnectedMessage(ctx, sendConnectedMessageInput{
		accountID:    accountID,
		clientID:     clientID,
		connectionID: connectionID,
	})
	if err != nil {
		logx.Errorln(err)
		return
	}
	connection := handlers.ConnectionFactory.CreateConnection(ctx, &CreateConnectionInput{
		AccountID:    accountID,
		ClientID:     clientID,
		ConnectionID: connectionID,
		conn:         conn,
		client:       handlers.MQTTClient,
	})
	handlers.ConnectionHub.Put(connection)
	defer handlers.ConnectionHub.Delete(connection.ID)
	if pendingStart, ok := handlers.PendingSessionStarts.Take(accountID, connectionID); ok {
		pendingStart.ClientID = clientID
		if err = handlers.publishBabyStationAnnouncement(accountID, pendingStart); err != nil {
			logx.Errorln(err)
		}
	}
	disconnectReason := "clean"
	defer func() {
		err = handlers.sendDisconnectedMessage(ctx, sendDisconnectedMessageInput{
			accountID:    accountID,
			clientID:     clientID,
			connectionID: connectionID,
			reason:       disconnectReason,
		})
		if err != nil {
			logx.Errorln(err)
		}
	}()

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
				if closeError.Code == websocket.CloseNormalClosure {
					return
				}
			}
			disconnectReason = "unexpected"
			logx.Errorln(err)
			return
		}
	}
}

type sendConnectedMessageInput struct {
	accountID    string
	clientID     string
	connectionID string
}

func (handlers *Handlers) sendConnectedMessage(ctx context.Context, input sendConnectedMessageInput) (err error) {
	topic := fmt.Sprintf(statusTopicFormat, input.accountID, input.clientID)
	payload, err := json.Marshal(map[string]any{
		"type":          "connected",
		"connection_id": input.connectionID,
		"at_millis":     time.Now().UnixMilli(),
	})
	if err != nil {
		return
	}
	return mqttx.Wait(handlers.MQTTClient.Publish(topic, 1, false, payload))
}

type sendDisconnectedMessageInput struct {
	accountID    string
	clientID     string
	connectionID string
	reason       string
}

func (handlers *Handlers) sendDisconnectedMessage(ctx context.Context, input sendDisconnectedMessageInput) (err error) {
	if input.reason == "" {
		input.reason = "clean"
	}
	topic := fmt.Sprintf(statusTopicFormat, input.accountID, input.clientID)
	payload, err := json.Marshal(map[string]any{
		"type":          "disconnected",
		"connection_id": input.connectionID,
		"disconnected": map[string]any{
			"reason": input.reason,
		},
		"at_millis": time.Now().UnixMilli(),
	})
	if err != nil {
		return
	}
	return mqttx.Wait(handlers.MQTTClient.Publish(topic, 1, false, payload))
}

type ConnectionFactory struct{}

type CreateConnectionInput struct {
	AccountID    string
	ClientID     string
	ConnectionID string
	conn         *websocket.Conn
	client       mqtt.Client
}

type Connection struct {
	AccountID string
	ClientID  string
	ID        string
	conn      *websocket.Conn
	client    mqtt.Client
	pongC     chan struct{}
	writeMu   sync.Mutex
}

func (factory *ConnectionFactory) CreateConnection(ctx context.Context, input *CreateConnectionInput) (connection *Connection) {
	connection = &Connection{
		AccountID: input.AccountID,
		ClientID:  input.ClientID,
		ID:        input.ConnectionID,
		conn:      input.conn,
		client:    input.client,
		pongC:     make(chan struct{}),
	}
	connection.conn.SetPongHandler(connection.handlePong)
	return
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
		return connection.WriteJSON(OutgoingMessage{
			Type: MessageTypePong,
		})
	case MessageTypeSignal:
		return connection.handleSignal(ctx, incomingMessage.Signal)
	default:
		return errors.New("unhandled message type: " + string(incomingMessage.Type))
	}
}

func (connection *Connection) handleSignal(ctx context.Context, incomingSignal *IncomingSignal) (err error) {
	topicClientID := incomingSignal.ToClientID
	if topicClientID == "" {
		topicClientID = connection.ClientID
	}
	inboxTopic := fmt.Sprintf(webrtcInboxTopicFormat, connection.AccountID, topicClientID)
	data, err := json.Marshal(map[string]any{
		"from_client_id":     connection.ClientID,
		"from_connection_id": connection.ID,
		"connection_id":      incomingSignal.ToConnectionID,
		"data":               json.RawMessage(incomingSignal.Data),
	})
	if err != nil {
		return
	}
	return mqttx.Wait(connection.client.Publish(inboxTopic, 1, false, data))
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

func (connection *Connection) WriteJSON(value any) error {
	connection.writeMu.Lock()
	defer connection.writeMu.Unlock()
	return connection.conn.WriteJSON(value)
}
