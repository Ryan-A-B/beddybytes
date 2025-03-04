package eventlog

import (
	"context"
)

type FollowInput struct {
	EventLog   EventLog
	FromCursor int64
}

func Follow(ctx context.Context, input FollowInput) EventIterator {
	eventIterator := input.EventLog.GetEventIterator(ctx, GetEventIteratorInput{
		FromCursor: input.FromCursor,
	})
	return &FollowingEventIterator{
		eventLog:      input.EventLog,
		eventIterator: eventIterator,
		waitC:         input.EventLog.Wait(ctx),
		cursor:        input.FromCursor,
	}
}

type FollowingEventIterator struct {
	eventLog      EventLog
	eventIterator EventIterator
	waitC         <-chan struct{}
	cursor        int64
}

func (iterator *FollowingEventIterator) Next(ctx context.Context) bool {
	if iterator.eventIterator.Next(ctx) {
		event := iterator.eventIterator.Event()
		iterator.cursor = event.LogicalClock
		return true
	}
	if iterator.eventIterator.Err() != nil {
		return false
	}
	select {
	case <-ctx.Done():
		return false
	case <-iterator.waitC:
		iterator.waitC = iterator.eventLog.Wait(ctx)
		iterator.eventIterator = iterator.eventLog.GetEventIterator(ctx, GetEventIteratorInput{
			FromCursor: iterator.cursor,
		})
		return iterator.Next(ctx)
	}
}

func (iterator *FollowingEventIterator) Event() *Event {
	return iterator.eventIterator.Event()
}

func (iterator *FollowingEventIterator) Err() error {
	return iterator.eventIterator.Err()
}
