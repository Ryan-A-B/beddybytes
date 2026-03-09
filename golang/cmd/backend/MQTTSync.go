package main

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/logx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mqttx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/sessionstartdecider"
	mqtt "github.com/eclipse/paho.mqtt.golang"
)

var (
	babyStationsTopicRegex      = regexp.MustCompile(`^accounts/([^/]+)/baby_stations$`)
	parentStationsTopicRegex    = regexp.MustCompile(`^accounts/([^/]+)/parent_stations$`)
	clientWebRTCInboxTopicRegex = regexp.MustCompile(`^accounts/([^/]+)/clients/([^/]+)/webrtc_inbox$`)
)

func (handlers *Handlers) RunMQTTSync(ctx context.Context) {
	subscriptions := []struct {
		topic   string
		handler mqtt.MessageHandler
	}{
		{topic: "accounts/+/baby_stations", handler: handlers.handleBabyStationsMessage},
		{topic: "accounts/+/parent_stations", handler: handlers.handleParentStationsMessage},
		{topic: "accounts/+/clients/+/webrtc_inbox", handler: handlers.handleWebRTCInboxMessage},
	}
	for _, subscription := range subscriptions {
		if err := mqttx.Wait(handlers.MQTTClient.Subscribe(subscription.topic, 1, subscription.handler)); err != nil {
			panic(err)
		}
	}
	<-ctx.Done()
}

func (handlers *Handlers) handleBabyStationsMessage(client mqtt.Client, message mqtt.Message) {
	defer message.Ack()
	accountID, ok := parseAccountID(message.Topic(), babyStationsTopicRegex)
	if !ok {
		logx.Warnln("invalid baby station topic:", message.Topic())
		return
	}
	var announcement babyStationAnnouncement
	if err := json.Unmarshal(message.Payload(), &announcement); err != nil {
		logx.Warnln(err)
		return
	}
	if announcement.ClientID == "" || announcement.ConnectionID == "" || announcement.Name == "" {
		logx.Warnln("invalid baby station announcement payload")
		return
	}
	startedAt := time.UnixMilli(announcement.StartedAtMillis)
	err := handlers.SessionStartDecider.Put(context.Background(), sessionstartdecider.Session{
		AccountID:        accountID,
		ID:               announcement.ConnectionID,
		Name:             announcement.Name,
		HostConnectionID: announcement.ConnectionID,
		StartedAt:        startedAt,
	})
	if err != nil && err != sessionstartdecider.ErrDuplicate {
		logx.Errorln(err)
	}
}

func (handlers *Handlers) handleParentStationsMessage(client mqtt.Client, message mqtt.Message) {
	defer message.Ack()
	accountID, ok := parseAccountID(message.Topic(), parentStationsTopicRegex)
	if !ok {
		logx.Warnln("invalid parent station topic:", message.Topic())
		return
	}
	var payload parentStationAnnouncementRequest
	if err := json.Unmarshal(message.Payload(), &payload); err != nil {
		logx.Warnln(err)
		return
	}
	if payload.ClientID == "" {
		logx.Warnln("missing client_id in parent station request")
		return
	}
	ctx := contextx.WithAccountID(context.Background(), accountID)
	snapshot, err := handlers.BabyStationList.GetSnapshot(ctx)
	if err != nil {
		logx.Errorln(err)
		return
	}
	for _, babyStation := range snapshot.List() {
		controlTopic := fmt.Sprintf("accounts/%s/clients/%s/control_inbox", accountID, payload.ClientID)
		controlMessage := controlMessageBabyStationAnnouncement{
			ControlMessageBase: ControlMessageBase{
				Type:     "baby_station_announcement",
				AtMillis: time.Now().UnixMilli(),
			},
			BabyStationAnnouncement: babyStationAnnouncement{
				ClientID:        babyStation.ClientID,
				ConnectionID:    babyStation.Connection.ID,
				Name:            babyStation.Name,
				StartedAtMillis: babyStation.StartedAt.UnixMilli(),
			},
		}
		encoded, err := json.Marshal(controlMessage)
		if err != nil {
			logx.Errorln(err)
			continue
		}
		if err := mqttx.Wait(handlers.MQTTClient.Publish(controlTopic, 1, false, encoded)); err != nil {
			logx.Errorln(err)
		}
	}
}

func (handlers *Handlers) handleWebRTCInboxMessage(client mqtt.Client, message mqtt.Message) {
	defer message.Ack()
	if !clientWebRTCInboxTopicRegex.MatchString(message.Topic()) {
		logx.Warnln("invalid webrtc inbox topic:", message.Topic())
		return
	}
	var inbox webrtcInboxMessage
	if err := json.Unmarshal(message.Payload(), &inbox); err != nil {
		logx.Warnln(err)
		return
	}
	if inbox.ConnectionID == "" {
		return
	}
	connection, ok := handlers.ConnectionHub.Get(inbox.ConnectionID)
	if !ok {
		return
	}
	signal, err := json.Marshal(inbox)
	if err != nil {
		logx.Errorln(err)
		return
	}
	if err := connection.WriteJSON(OutgoingMessage{
		Type:   MessageTypeSignal,
		Signal: signal,
	}); err != nil {
		logx.Errorln(err)
	}
}

func parseAccountID(topic string, pattern *regexp.Regexp) (string, bool) {
	matches := pattern.FindStringSubmatch(topic)
	if len(matches) != 2 {
		return "", false
	}
	return matches[1], true
}

type babyStationAnnouncement struct {
	ClientID        string `json:"client_id"`
	ConnectionID    string `json:"connection_id"`
	Name            string `json:"name"`
	StartedAtMillis int64  `json:"started_at_millis"`
}

type parentStationAnnouncementRequest struct {
	ClientID string `json:"client_id"`
}

type webrtcInboxMessage struct {
	FromClientID string          `json:"from_client_id"`
	ConnectionID string          `json:"connection_id"`
	Data         json.RawMessage `json:"data"`
}

type ControlMessageBase struct {
	Type     string `json:"type"`
	AtMillis int64  `json:"at_millis"`
}

type controlMessageBabyStationAnnouncement struct {
	ControlMessageBase
	BabyStationAnnouncement babyStationAnnouncement `json:"baby_station_announcement"`
}
