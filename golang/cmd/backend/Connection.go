package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	uuid "github.com/satori/go.uuid"

	"github.com/Ryan-A-B/beddybytes/golang/internal/backendmqtt"
	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/logx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mqttx"
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
	requestID := uuid.NewV4().String()
	conn, err := handlers.Upgrader.Upgrade(responseWriter, request, nil)
	if err != nil {
		logx.Errorln(err)
		return
	}
	defer conn.Close()
	inboxTopic := backendmqtt.ClientWebRTCInboxTopic(accountID, clientID)
	token := handlers.MQTTClient.Subscribe(inboxTopic, 1, func(client mqtt.Client, message mqtt.Message) {
		payload := new(backendmqtt.WebRTCInboxPayload)
		err := json.Unmarshal(message.Payload(), payload)
		fatal.OnError(err)
		sender, ok := handlers.ConnectionRegistry.GetByClientID(accountID, payload.FromClientID)
		if !ok {
			logx.Warnln("sender not found for client:", payload.FromClientID)
			message.Ack()
			return
		}

		err = conn.WriteJSON(OutgoingMessage{
			Type:   MessageTypeSignal,
			Signal: &OutgoingSignal{
				FromConnectionID: sender.ConnectionID,
				Data:             payload.SignalData(),
			},
		})
		if err != nil {
			logx.Errorln(err)
			return
		}
		message.Ack()
	})
	err = mqttx.Wait(token)
	if err != nil {
		logx.Errorln(err)
		return
	}
	// Wait for the subscription to propagate
	readyC := time.After(500 * time.Millisecond)
	err = handlers.sendConnectedMessage(ctx, sendConnectedMessageInput{
		accountID:    accountID,
		clientID:     clientID,
		connectionID: connectionID,
		requestID:    requestID,
	})
	if err != nil {
		logx.Errorln(err)
		return
	}
	defer func() {
		err = handlers.sendDisconnectedMessage(ctx, sendDisconnectedMessageInput{
			accountID:    accountID,
			clientID:     clientID,
			connectionID: connectionID,
			requestID:    requestID,
		})
		if err != nil {
			logx.Errorln(err)
		}
		err = mqttx.Wait(handlers.MQTTClient.Unsubscribe(inboxTopic))
		if err != nil {
			logx.Errorln(err)
		}
	}()
	connection := handlers.ConnectionFactory.CreateConnection(ctx, &CreateConnectionInput{
		AccountID:    accountID,
		ClientID:     clientID,
		ConnectionID: connectionID,
		conn:         conn,
		client:       handlers.MQTTClient,
		registry:     handlers.ConnectionRegistry,
	})
	errC := make(chan error, 1)
	go func() {
		errC <- connection.runKeepAlive(ctx)
	}()
	go func() {
		<-readyC
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
			logx.Errorln(err)
			return
		}
	}
}

type sendConnectedMessageInput struct {
	accountID    string
	clientID     string
	connectionID string
	requestID    string
}

func (handlers *Handlers) sendConnectedMessage(ctx context.Context, input sendConnectedMessageInput) (err error) {
	topic := backendmqtt.ClientStatusTopic(input.accountID, input.clientID)
	payload := fatal.UnlessMarshalJSON(backendmqtt.NewConnectedStatusPayload(input.connectionID, input.requestID, time.Now()))
	return mqttx.Wait(handlers.MQTTClient.Publish(topic, 1, false, payload))
}

type sendDisconnectedMessageInput struct {
	accountID    string
	clientID     string
	connectionID string
	requestID    string
}

func (handlers *Handlers) sendDisconnectedMessage(ctx context.Context, input sendDisconnectedMessageInput) (err error) {
	topic := backendmqtt.ClientStatusTopic(input.accountID, input.clientID)
	payload := fatal.UnlessMarshalJSON(backendmqtt.NewDisconnectedStatusPayload(input.connectionID, input.requestID, time.Now(), backendmqtt.DisconnectReasonClean))
	return mqttx.Wait(handlers.MQTTClient.Publish(topic, 1, false, payload))
}

type ConnectionFactory struct{}

type CreateConnectionInput struct {
	AccountID    string
	ClientID     string
	ConnectionID string
	conn         *websocket.Conn
	client       mqtt.Client
	registry     *backendmqtt.ConnectionRegistry
}

type Connection struct {
	AccountID string
	ClientID  string
	ID        string
	conn      *websocket.Conn
	client    mqtt.Client
	registry  *backendmqtt.ConnectionRegistry
	pongC     chan struct{}
}

func (factory *ConnectionFactory) CreateConnection(ctx context.Context, input *CreateConnectionInput) (connection *Connection) {
	connection = &Connection{
		AccountID: input.AccountID,
		ClientID:  input.ClientID,
		ID:        input.ConnectionID,
		conn:      input.conn,
		client:    input.client,
		registry:  input.registry,
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
		return connection.conn.WriteJSON(OutgoingMessage{
			Type: MessageTypePong,
		})
	case MessageTypeSignal:
		return connection.handleSignal(ctx, incomingMessage.Signal)
	default:
		return errors.New("unhandled message type: " + string(incomingMessage.Type))
	}
}

func (connection *Connection) handleSignal(ctx context.Context, incomingSignal *IncomingSignal) (err error) {
	target, ok := connection.registry.GetByConnectionID(connection.AccountID, incomingSignal.ToConnectionID)
	if !ok {
		logx.Warnln("target connection not found:", incomingSignal.ToConnectionID)
		return nil
	}
	inboxTopic := backendmqtt.ClientWebRTCInboxTopic(connection.AccountID, target.ClientID)
	data, err := json.Marshal(backendmqtt.NewWebRTCInboxPayload(connection.ClientID, incomingSignal.Data))
	fatal.OnError(err)
	return mqttx.Wait(connection.client.Publish(inboxTopic, 1, false, []byte(data)))
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
