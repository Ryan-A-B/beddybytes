package eventlog

import (
	"context"
	"encoding/json"

	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
)

// Add Resource URN to event log
// urn:{account_id}:session/{session_id} ???

type Event struct {
	ID            string          `json:"id"`
	Type          string          `json:"type"`
	AccountID     string          `json:"account_id,omitempty"`
	LogicalClock  int64           `json:"logical_clock"`
	UnixTimestamp int64           `json:"unix_timestamp"`
	Data          json.RawMessage `json:"data"`
}

type AppendInput struct {
	Type      string
	AccountID string
	Data      json.RawMessage
}

type GetEventIteratorInput struct {
	FromCursor int64
}

type EventLog interface {
	Append(ctx context.Context, input AppendInput) (event *Event, err error)
	GetEventIterator(ctx context.Context, input GetEventIteratorInput) (iterator EventIterator)
	Wait(ctx context.Context) <-chan struct{}
}

type EventIterator interface {
	Next(ctx context.Context) bool
	Event() *Event
	Err() error
}

type ProjectInput struct {
	EventLog   EventLog
	FromCursor int64
	Apply      func(ctx context.Context, event *Event)
}

func Project(ctx context.Context, input ProjectInput) {
	iterator := Follow(ctx, FollowInput{
		EventLog:   input.EventLog,
		FromCursor: input.FromCursor,
	})
	for iterator.Next(ctx) {
		input.Apply(ctx, iterator.Event())
	}
	fatal.OnError(iterator.Err())
}

type StreamToChannelInput struct {
	EventLog   EventLog
	FromCursor int64
	C          chan *Event
}

func StreamToChannel(ctx context.Context, input StreamToChannelInput) {
	iterator := input.EventLog.GetEventIterator(ctx, GetEventIteratorInput{
		FromCursor: input.FromCursor,
	})
	for iterator.Next(ctx) {
		input.C <- iterator.Event()
	}
	fatal.OnError(iterator.Err())
}
