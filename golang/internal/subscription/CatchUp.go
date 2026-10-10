package subscription

import (
	"context"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

type CatchUpInput struct {
	Log    eventlog.EventLog
	Cursor int64
	Apply  func(ctx context.Context, event *eventlog.Event)
}

func CatchUp(ctx context.Context, input CatchUpInput) (cursor int64, err error) {
	cursor = input.Cursor
	iterator := input.Log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{
		FromCursor: cursor,
	})
	for iterator.Next(ctx) {
		event := iterator.Event()
		input.Apply(ctx, event)
		cursor = event.LogicalClock
	}
	err = iterator.Err()
	if err != nil {
		return
	}
	return
}
