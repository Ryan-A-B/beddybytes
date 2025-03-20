package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	uuid "github.com/satori/go.uuid"

	"github.com/Ryan-A-B/beddybytes/golang/internal/connections"
	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/logx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/messages"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mqttx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/store2"
)

const inboxTopicFormat = "accounts/%s/connections/%s/inbox"
const statusTopicFormat = "accounts/%s/connections/%s/status"

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
	mqttClient := handlers.CreateMQTTClient(connectionID)
	err = mqttx.Wait(mqttClient.Connect())
	if err != nil {
		logx.Errorln(err)
		return
	}
	defer mqttClient.Disconnect(250)
	inboxTopic := fmt.Sprintf(inboxTopicFormat, accountID, connectionID)
	token := mqttClient.Subscribe(inboxTopic, 1, func(client mqtt.Client, message mqtt.Message) {
		signal := new(OutgoingSignal)
		err := json.Unmarshal(message.Payload(), signal)
		fatal.OnError(err)

		err = conn.WriteJSON(OutgoingMessage{
			Type:   MessageTypeSignal,
			Signal: signal,
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
	err = handlers.sendConnectedMessage(ctx, sendConnectedMessageInput{
		client:       mqttClient,
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
		handlers.sendDisconnectedMessage(ctx, sendDisconnectedMessageInput{
			client:       mqttClient,
			accountID:    accountID,
			clientID:     clientID,
			connectionID: connectionID,
			requestID:    requestID,
		})
	}()
	connection := handlers.ConnectionFactory.CreateConnection(ctx, &CreateConnectionInput{
		AccountID:    accountID,
		ConnectionID: connectionID,
		conn:         conn,
		client:       mqttClient,
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
	client       mqtt.Client
	accountID    string
	clientID     string
	connectionID string
	requestID    string
}

func (handlers *Handlers) sendConnectedMessage(ctx context.Context, input sendConnectedMessageInput) (err error) {
	topic := fmt.Sprintf(statusTopicFormat, input.accountID, input.connectionID)
	payload := fatal.UnlessMarshalJSON(connections.MessageFrame{
		MessageFrameBase: messages.MessageFrameBase{
			Type: connections.MessageTypeConnected,
		},
		Connected: &connections.MessageConnected{
			ClientID:  input.clientID,
			RequestID: input.requestID,
		},
	})
	return mqttx.Wait(input.client.Publish(topic, 1, false, payload))
}

type sendDisconnectedMessageInput struct {
	client       mqtt.Client
	accountID    string
	clientID     string
	connectionID string
	requestID    string
}

func (handlers *Handlers) sendDisconnectedMessage(ctx context.Context, input sendDisconnectedMessageInput) (err error) {
	topic := fmt.Sprintf(statusTopicFormat, input.accountID, input.connectionID)
	payload := fatal.UnlessMarshalJSON(connections.MessageFrame{
		MessageFrameBase: messages.MessageFrameBase{
			Type: connections.MessageTypeDisconnected,
		},
		Disconnected: &connections.MessageDisconnected{
			ClientID:  input.clientID,
			RequestID: input.requestID,
		},
	})
	return mqttx.Wait(input.client.Publish(topic, 1, false, payload))
}

type ConnectionFactory struct {
	ConnectionStore store2.Store[ConnectionStoreKey, *Connection]
}

type CreateConnectionInput struct {
	AccountID    string
	ConnectionID string
	conn         *websocket.Conn
	client       mqtt.Client
}

type Connection struct {
	AccountID string
	ID        string
	conn      *websocket.Conn
	client    mqtt.Client
	pongC     chan struct{}
}

func (factory *ConnectionFactory) CreateConnection(ctx context.Context, input *CreateConnectionInput) (connection *Connection) {
	connection = &Connection{
		AccountID: input.AccountID,
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
	inboxTopic := fmt.Sprintf(inboxTopicFormat, connection.AccountID, incomingSignal.ToConnectionID)
	data, err := json.Marshal(OutgoingSignal{
		FromConnectionID: connection.ID,
		Data:             incomingSignal.Data,
	})
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
