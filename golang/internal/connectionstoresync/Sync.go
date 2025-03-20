package connectionstoresync

import (
	"context"
	"encoding/json"
	"log"
	"regexp"

	"github.com/Ryan-A-B/beddybytes/golang/internal/connections"
	"github.com/Ryan-A-B/beddybytes/golang/internal/connectionstore"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/logx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/messages"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mqttx"
	mqtt "github.com/eclipse/paho.mqtt.golang"
)

var connectionStore *connectionstore.Decider
var handlers = map[messages.MessageType]func(ctx context.Context, input handlerInput){
	connections.MessageTypeConnected:    handleConnectedMessage,
	connections.MessageTypeDisconnected: handleDisconnectedMessage,
}
var topicRegex = regexp.MustCompile(`^accounts/([^/]+)/connections/([^/]+)/status$`)

type RunInput struct {
	CreateClient    func() mqtt.Client
	ConnectionStore *connectionstore.Decider
}

func Run(ctx context.Context, input RunInput) {
	if connectionStore != nil {
		panic("already running")
	}
	connectionStore = input.ConnectionStore
	client := input.CreateClient()
	token := client.Connect()
	err := mqttx.Wait(token)
	fatal.OnError(err)
	err = mqttx.Wait(client.Subscribe("accounts/+/connections/+/status", 1, handleMessage))
	fatal.OnError(err)
	<-ctx.Done()
	// TODO unsubscribe? I don't expect the chan to be closed
}

func handleMessage(client mqtt.Client, message mqtt.Message) {
	ctx := context.Background()
	var frame connections.MessageFrame
	err := json.Unmarshal(message.Payload(), &frame)
	if err != nil {
		logx.Warnln(err)
		return
	}
	var accountID string
	var connectionID string
	// TODO why wouldn't it match? seems redundant
	matches := topicRegex.FindStringSubmatch(message.Topic())
	fatal.Unless(len(matches) == 3, "failed to parse topic: "+message.Topic())
	accountID, connectionID = matches[1], matches[2]
	handle, ok := handlers[frame.Type]
	if !ok {
		logx.Warnln("unhandled message type:", frame.Type)
		return
	}
	handle(ctx, handlerInput{
		AccountID:    accountID,
		ConnectionID: connectionID,
		Frame:        frame,
	})
	message.Ack()
}

func handleConnectedMessage(ctx context.Context, input handlerInput) {
	err := connectionStore.Put(ctx, connectionstore.Connection{
		ID:        input.ConnectionID,
		AccountID: input.AccountID,
		ClientID:  input.Frame.Connected.ClientID,
		RequestID: input.Frame.Connected.RequestID,
	})
	if err != nil {
		log.Fatal(err)
	}
}

func handleDisconnectedMessage(ctx context.Context, input handlerInput) {
	err := connectionStore.Delete(ctx, connectionstore.Connection{
		ID:        input.ConnectionID,
		AccountID: input.AccountID,
		ClientID:  input.Frame.Disconnected.ClientID,
		RequestID: input.Frame.Disconnected.RequestID,
	})
	if err != nil {
		log.Fatal(err)
	}
}

type handlerInput struct {
	AccountID    string
	ConnectionID string
	Frame        connections.MessageFrame
}
