package messages

type MessageType string

type MessageFrameBase struct {
	Type MessageType `json:"type"`
}
