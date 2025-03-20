package connections

const EventTypeConnected string = "client.connected"
const EventTypeDisconnected string = "client.disconnected"

type EventConnected struct {
	ClientID     string `json:"client_id"`
	ConnectionID string `json:"connection_id"`
	RequestID    string `json:"request_id"`
}

type EventDisconnected struct {
	ClientID     string `json:"client_id"`
	ConnectionID string `json:"connection_id"`
	RequestID    string `json:"request_id"`
}
