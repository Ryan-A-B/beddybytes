package connections

import "github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"

const EventTypeConnected eventlog.EventType = "client.connected"
const EventTypeDisconnected eventlog.EventType = "client.disconnected"
const EventTypeReconnectTimeout eventlog.EventType = "client.reconnect_timeout"

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
