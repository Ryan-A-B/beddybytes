package backendmqtt

import "fmt"

const (
	clientStatusTopicFormat     = "accounts/%s/clients/%s/status"
	clientWebRTCInboxTopicFormat = "accounts/%s/clients/%s/webrtc_inbox"
	clientControlInboxTopicFormat = "accounts/%s/clients/%s/control_inbox"
	babyStationsTopicFormat     = "accounts/%s/baby_stations"
	parentStationsTopicFormat   = "accounts/%s/parent_stations"
)

func ClientStatusTopic(accountID string, clientID string) string {
	return fmt.Sprintf(clientStatusTopicFormat, accountID, clientID)
}

func ClientWebRTCInboxTopic(accountID string, clientID string) string {
	return fmt.Sprintf(clientWebRTCInboxTopicFormat, accountID, clientID)
}

func ClientControlInboxTopic(accountID string, clientID string) string {
	return fmt.Sprintf(clientControlInboxTopicFormat, accountID, clientID)
}

func BabyStationsTopic(accountID string) string {
	return fmt.Sprintf(babyStationsTopicFormat, accountID)
}

func ParentStationsTopic(accountID string) string {
	return fmt.Sprintf(parentStationsTopicFormat, accountID)
}
