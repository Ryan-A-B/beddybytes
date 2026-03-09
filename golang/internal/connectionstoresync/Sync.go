package connectionstoresync

import (
	"context"
	"encoding/json"
	"log"
	"regexp"

	"github.com/Ryan-A-B/beddybytes/golang/internal/connectionstore"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/logx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mqttx"
	mqtt "github.com/eclipse/paho.mqtt.golang"
)

var connectionStore *connectionstore.Decider
var handlers = map[string]func(ctx context.Context, input handlerInput){
	"connected":    handleConnectedMessage,
	"disconnected": handleDisconnectedMessage,
}
var topicRegex = regexp.MustCompile(`^accounts/([^/]+)/clients/([^/]+)/status$`)

type RunInput struct {
	MQTTClient      mqtt.Client
	ConnectionStore *connectionstore.Decider
}

func Run(ctx context.Context, input RunInput) {
	if connectionStore != nil {
		panic("already running")
	}
	connectionStore = input.ConnectionStore
	err := mqttx.Wait(input.MQTTClient.Subscribe("accounts/+/clients/+/status", 1, handleMessage))
	fatal.OnError(err)
	<-ctx.Done()
}

func handleMessage(client mqtt.Client, message mqtt.Message) {
	ctx := context.Background()
	var status statusMessage
	err := json.Unmarshal(message.Payload(), &status)
	if err != nil {
		logx.Warnln(err)
		return
	}
	var accountID string
	var clientID string
	matches := topicRegex.FindStringSubmatch(message.Topic())
	fatal.Unless(len(matches) == 3, "failed to parse topic: "+message.Topic())
	accountID, clientID = matches[1], matches[2]
	handle, ok := handlers[status.Type]
	if !ok {
		logx.Warnln("unhandled message type:", status.Type)
		return
	}
	handle(ctx, handlerInput{
		AccountID: accountID,
		ClientID:  clientID,
		Status:    status,
	})
	message.Ack()
}

func handleConnectedMessage(ctx context.Context, input handlerInput) {
	err := connectionStore.Put(ctx, connectionstore.Connection{
		ID:        input.Status.ConnectionID,
		AccountID: input.AccountID,
		ClientID:  input.ClientID,
		AtMillis:  input.Status.AtMillis,
	})
	if err != nil {
		if err == connectionstore.ErrDuplicate {
			return
		}
		log.Fatal(err)
	}
}

func handleDisconnectedMessage(ctx context.Context, input handlerInput) {
	err := connectionStore.Delete(ctx, connectionstore.Connection{
		ID:               input.Status.ConnectionID,
		AccountID:        input.AccountID,
		ClientID:         input.ClientID,
		AtMillis:         input.Status.AtMillis,
		DisconnectReason: input.Status.Disconnected.Reason,
	})
	if err != nil {
		if err == connectionstore.ErrDuplicate {
			return
		}
		log.Fatal(err)
	}
}

type handlerInput struct {
	AccountID string
	ClientID  string
	Status    statusMessage
}

type statusMessage struct {
	Type         string `json:"type"`
	ConnectionID string `json:"connection_id"`
	AtMillis     int64  `json:"at_millis"`
	Disconnected struct {
		Reason string `json:"reason"`
	} `json:"disconnected"`
}
