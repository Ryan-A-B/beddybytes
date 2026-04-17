package backendmqtt

import "fmt"

const (
	clientStatusTopicFormat     = "accounts/%s/clients/%s/status"
	clientWebRTCInboxTopicFormat = "accounts/%s/clients/%s/webrtc_inbox"
	babyStationsTopicFormat     = "accounts/%s/baby_stations"
)

func ClientStatusTopic(accountID string, clientID string) string {
	return fmt.Sprintf(clientStatusTopicFormat, accountID, clientID)
}

func ClientWebRTCInboxTopic(accountID string, clientID string) string {
	return fmt.Sprintf(clientWebRTCInboxTopicFormat, accountID, clientID)
}

func BabyStationsTopic(accountID string) string {
	return fmt.Sprintf(babyStationsTopicFormat, accountID)
}
