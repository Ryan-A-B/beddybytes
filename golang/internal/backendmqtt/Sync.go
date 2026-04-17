package backendmqtt

import (
	"context"
	"encoding/json"
	"log"
	"regexp"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/connectionstore"
	"github.com/Ryan-A-B/beddybytes/golang/internal/connections"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/logx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mqttx"
	mqtt "github.com/eclipse/paho.mqtt.golang"
)

var clientStatusTopicRegex = regexp.MustCompile(`^accounts/([^/]+)/clients/([^/]+)/status$`)
var babyStationsTopicRegex = regexp.MustCompile(`^accounts/([^/]+)/baby_stations$`)

type RunClientStatusSyncInput struct {
	MQTTClient            mqtt.Client
	ConnectionStore       *connectionstore.Decider
	ConnectionRegistry    *ConnectionRegistry
	PendingSessionStarts  *PendingSessionStarts
}

func RunClientStatusSync(ctx context.Context, input RunClientStatusSyncInput) {
	err := mqttx.Wait(input.MQTTClient.Subscribe("accounts/+/clients/+/status", 1, func(client mqtt.Client, message mqtt.Message) {
		handleClientStatusMessage(client, message, input)
	}))
	fatal.OnError(err)
	<-ctx.Done()
}

func handleClientStatusMessage(client mqtt.Client, message mqtt.Message, input RunClientStatusSyncInput) {
	defer message.Ack()
	var payload ClientStatusPayload
	if err := json.Unmarshal(message.Payload(), &payload); err != nil {
		logx.Warnln(err)
		return
	}
	matches := clientStatusTopicRegex.FindStringSubmatch(message.Topic())
	if len(matches) != 3 {
		logx.Warnln("failed to parse topic:", message.Topic())
		return
	}
	accountID, clientID := matches[1], matches[2]
	connection := connectionstore.Connection{
		ID:        payload.ConnectionID,
		AccountID: accountID,
		ClientID:  clientID,
		RequestID: payload.RequestID,
	}
	switch payload.Type {
	case ClientStatusTypeConnected:
		input.ConnectionRegistry.Put(accountID, ConnectionInfo{
			ClientID:     clientID,
			ConnectionID: payload.ConnectionID,
			RequestID:    payload.RequestID,
		})
		if err := input.ConnectionStore.Put(context.Background(), connection); err != nil && err != connectionstore.ErrDuplicate {
			log.Fatal(err)
		}
		pending, ok := input.PendingSessionStarts.Take(accountID, payload.ConnectionID)
		if !ok {
			return
		}
		err := PublishBabyStationAnnouncement(input.MQTTClient, accountID, BabyStationsPayload{
			Type:     AnnouncementType,
			AtMillis: pending.StartedAt.UnixMilli(),
			Announcment: BabyStationAnnouncment{
				ClientID:     clientID,
				ConnectionID: pending.ConnectionID,
				SessionID:    pending.SessionID,
				Name:         pending.Name,
			},
		})
		if err != nil {
			logx.Errorln(err)
		}
	case ClientStatusTypeDisconnected:
		input.ConnectionRegistry.Delete(accountID, ConnectionInfo{
			ClientID:     clientID,
			ConnectionID: payload.ConnectionID,
			RequestID:    payload.RequestID,
		})
		if err := input.ConnectionStore.Delete(context.Background(), connection); err != nil && err != connectionstore.ErrDuplicate {
			log.Fatal(err)
		}
	default:
		logx.Warnln("unhandled client status type:", payload.Type)
	}
}

func PublishBabyStationAnnouncement(client mqtt.Client, accountID string, payload BabyStationsPayload) error {
	data := fatal.UnlessMarshalJSON(payload)
	return mqttx.Wait(client.Publish(BabyStationsTopic(accountID), 1, false, data))
}

type RunBabyStationAnnouncementSyncInput struct {
	MQTTClient mqtt.Client
	EventLog   eventlog.EventLog
}

func RunBabyStationAnnouncementSync(ctx context.Context, input RunBabyStationAnnouncementSyncInput) {
	err := mqttx.Wait(input.MQTTClient.Subscribe("accounts/+/baby_stations", 1, func(client mqtt.Client, message mqtt.Message) {
		handleBabyStationAnnouncementMessage(message, input)
	}))
	fatal.OnError(err)
	<-ctx.Done()
}

func handleBabyStationAnnouncementMessage(message mqtt.Message, input RunBabyStationAnnouncementSyncInput) {
	defer message.Ack()
	var payload BabyStationsPayload
	if err := json.Unmarshal(message.Payload(), &payload); err != nil {
		logx.Warnln(err)
		return
	}
	if payload.Type != AnnouncementType {
		logx.Warnln("unhandled baby station message type:", payload.Type)
		return
	}
	matches := babyStationsTopicRegex.FindStringSubmatch(message.Topic())
	if len(matches) != 2 {
		logx.Warnln("failed to parse topic:", message.Topic())
		return
	}
	accountID := matches[1]
	startedAt := time.Unix(0, payload.AtMillis*int64(time.Millisecond))
	data := fatal.UnlessMarshalJSON(struct {
		ID               string    `json:"id"`
		Name             string    `json:"name"`
		HostConnectionID string    `json:"host_connection_id"`
		StartedAt        time.Time `json:"started_at"`
	}{
		ID:               payload.Announcment.SessionID,
		Name:             payload.Announcment.Name,
		HostConnectionID: payload.Announcment.ConnectionID,
		StartedAt:        startedAt,
	})
	_, err := input.EventLog.Append(context.Background(), eventlog.AppendInput{
		Type:      "session.started",
		AccountID: accountID,
		Data:      data,
	})
	if err != nil {
		logx.Errorln(err)
	}
}

func NewConnectedStatusPayload(connectionID string, requestID string, at time.Time) ClientStatusPayload {
	return ClientStatusPayload{
		Type:         ClientStatusTypeConnected,
		ConnectionID: connectionID,
		RequestID:    requestID,
		AtMillis:     at.UnixMilli(),
	}
}

func NewDisconnectedStatusPayload(connectionID string, requestID string, at time.Time, reason DisconnectReason) ClientStatusPayload {
	return ClientStatusPayload{
		Type:         ClientStatusTypeDisconnected,
		ConnectionID: connectionID,
		RequestID:    requestID,
		AtMillis:     at.UnixMilli(),
		Disconnected: &ClientStatusDisconnected{
			Reason: reason,
		},
	}
}

func ConnectedEventData(clientID string, connectionID string, requestID string) connections.EventConnected {
	return connections.EventConnected{
		ClientID:     clientID,
		ConnectionID: connectionID,
		RequestID:    requestID,
	}
}
