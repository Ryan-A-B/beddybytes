package shared

import (
	"encoding/json"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

const (
	EventTypeServerStarted      = "server.started"
	EventTypeSessionStarted     = "session.started"
	EventTypeSessionEnded       = "session.ended"
	EventTypeClientConnected    = "client.connected"
	EventTypeClientDisconnected = "client.disconnected"
)

type StartSessionEventData struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	HostConnectionID string    `json:"host_connection_id"`
	StartedAt        time.Time `json:"started_at"`
}

type EndSessionEventData struct {
	ID string `json:"id"`
}

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

type SessionInfo struct {
	ID               string
	AccountID        string
	HostConnectionID string
	StartTime        time.Time
}

type DisconnectedSessionInfo struct {
	*SessionInfo
	DisconnectTime time.Time
}

func EventTime(event *eventlog.Event) time.Time {
	return time.Unix(event.UnixTimestamp, 0)
}

func MustUnmarshal(data []byte, target interface{}) {
	if err := json.Unmarshal(data, target); err != nil {
		panic(err)
	}
}

func DisconnectWasClean(closeCode int) bool {
	switch closeCode {
	case 1000, 1001:
		return true
	default:
		return false
	}
}
