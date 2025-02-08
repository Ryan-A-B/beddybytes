package connections

import "github.com/Ryan-A-B/beddybytes/golang/internal/messages"

const MessageTypeConnected messages.MessageType = "connected"
const MessageTypeDisconnected messages.MessageType = "disconnected"

type MessageFrame struct {
	messages.MessageFrameBase
	Connected    *MessageConnected    `json:"connected,omitempty"`
	Disconnected *MessageDisconnected `json:"disconnected,omitempty"`
}

type MessageConnected struct {
	ClientID  string `json:"client_id"`
	RequestID string `json:"request_id"`
}

type MessageDisconnected struct {
	ClientID  string `json:"client_id"`
	RequestID string `json:"request_id"`
}
