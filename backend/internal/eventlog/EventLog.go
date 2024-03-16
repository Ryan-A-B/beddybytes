package eventlog

import (
	"context"
	"encoding/json"

	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
)

// Add Resource URN to event log
// urn:{account_id}:session/{session_id} ???

type Event struct {
	ID            string          `json:"id"`
	Type          string          `json:"type"`
	AccountID     string          `json:"account_id,omitempty"`
	LogicalClock  int             `json:"logical_clock"`
	UnixTimestamp int64           `json:"unix_timestamp"`
	Data          json.RawMessage `json:"data"`
}

type AppendInput struct {
	Type      string
	AccountID string
	Data      json.RawMessage
}

type GetEventIteratorInput struct {
	FromCursor int
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

type ProjectInput struct {
	EventLog   EventLog
	FromCursor int
	Apply      func(ctx context.Context, event *Event)
}

func Project(ctx context.Context, input *ProjectInput) {
	iterator := input.EventLog.GetEventIterator(ctx, &GetEventIteratorInput{
		FromCursor: input.FromCursor,
	})
	for iterator.Next() {
		input.Apply(ctx, iterator.Event())
	}
	fatal.OnError(iterator.Err())
}

type StreamToChannelInput struct {
	EventLog   EventLog
	FromCursor int
	C          chan *Event
}

func StreamToChannel(ctx context.Context, input *StreamToChannelInput) {
	iterator := input.EventLog.GetEventIterator(ctx, &GetEventIteratorInput{
		FromCursor: input.FromCursor,
	})
	for iterator.Next() {
		input.C <- iterator.Event()
	}
	fatal.OnError(iterator.Err())
}
