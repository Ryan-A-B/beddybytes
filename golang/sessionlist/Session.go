package sessionlist

import "time"

type ConnectionState string

const (
	ConnectionStateConnected    ConnectionState = "connected"
	ConnectionStateDisconnected ConnectionState = "disconnected"
)

type Session struct {
	AccountID           string              `json:"-"`
	ID                  string              `json:"id"`
	Name                string              `json:"name"`
	HostConnectionID    string              `json:"host_connection_id"`
	StartedAt           time.Time           `json:"started_at"`
	HostConnectionState HostConnectionState `json:"host_connection_state"`
}

type HostConnectionState interface {
	GetState() ConnectionState
	GetSince() int64
}

type HostConnectionStateBase struct {
	State ConnectionState `json:"state"`
	Since int64           `json:"since"`
}

func (state HostConnectionStateBase) GetState() ConnectionState {
	return state.State
}

func (state HostConnectionStateBase) GetSince() int64 {
	return state.Since
}

type HostConnectionStateConnected struct {
	HostConnectionStateBase
	RequestID string `json:"request_id"`
}

type HostConnectionStateDisconnected struct {
	HostConnectionStateBase
}
