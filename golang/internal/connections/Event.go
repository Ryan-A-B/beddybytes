package connections

const EventTypeConnected string = "client.connected"
const EventTypeDisconnected string = "client.disconnected"
const EventTypeReconnectTimeout string = "client.reconnect_timeout"

const DisconnectReasonClean string = "clean"
const DisconnectReasonUnexpected string = "unexpected"

type EventConnected struct {
	ClientID     string `json:"client_id"`
	ConnectionID string `json:"connection_id"`
	RequestID    string `json:"request_id"`
}

type EventDisconnected struct {
	ClientID     string `json:"client_id"`
	ConnectionID string `json:"connection_id"`
	RequestID    string `json:"request_id"`
	Reason       string `json:"reason,omitempty"`
}

type EventReconnectTimeout struct {
	ClientID     string `json:"client_id"`
	ConnectionID string `json:"connection_id"`
	RequestID    string `json:"request_id"`
}
