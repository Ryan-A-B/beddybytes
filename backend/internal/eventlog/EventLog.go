package eventlog

import (
	"context"
	"encoding/json"
)

// Add Resource URN to event log
// urn:{account_id}:session/{session_id} ???

type Event struct {
	ID            string          `json:"id"`
	Type          string          `json:"type"`
	LogicalClock  int             `json:"logical_clock"`
	UnixTimestamp int64           `json:"unix_timestamp"`
	Data          json.RawMessage `json:"data"`
}

type AppendInput struct {
	Type string
	Data json.RawMessage
}

type GetEventIteratorInput struct {
	Cursor int
}

type EventLog interface {
	Append(ctx context.Context, input *AppendInput) (event *Event, err error)
	GetEventIterator(ctx context.Context, input *GetEventIteratorInput) (iterator EventIterator)
}

type EventIterator interface {
	Next() bool
	Event() *Event
	Err() error
}
