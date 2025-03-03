package eventlog

import (
	"context"

	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
)

type CachingDecorator struct {
	decorated EventLog
	events    []*Event
}

type NewCachingDecoratorInput struct {
	Decorated EventLog
}

func NewCachingDecorator(ctx context.Context, input NewCachingDecoratorInput) (decorator *CachingDecorator, err error) {
	events := make([]*Event, 0)
	iterator := input.Decorated.GetEventIterator(ctx, GetEventIteratorInput{
		FromCursor: 0,
	})
	lastLogicalClock := int64(0)
	for iterator.Next(ctx) {
		event := iterator.Event()
		if event.LogicalClock <= lastLogicalClock {
			continue
		}
		events = append(events, event)
		lastLogicalClock = event.LogicalClock
	}
	err = iterator.Err()
	if err != nil {
		return
	}
	decorator = &CachingDecorator{
		decorated: input.Decorated,
		events:    events,
	}
	return
}

func NewCachingDecoratorOrFatal(ctx context.Context, input NewCachingDecoratorInput) *CachingDecorator {
	decorator, err := NewCachingDecorator(ctx, input)
	fatal.OnError(err)
	return decorator
}

func (decorator *CachingDecorator) Append(ctx context.Context, input AppendInput) (event *Event, err error) {
	event, err = decorator.decorated.Append(ctx, input)
	if err != nil {
		return
	}
	decorator.events = append(decorator.events, event)
	return
}

func (decorator *CachingDecorator) GetEventIterator(ctx context.Context, input GetEventIteratorInput) (iterator EventIterator) {
	return &SliceEventIterator{
		events: decorator.events,
		index:  input.FromCursor - 1,
	}
}

func (decorator *CachingDecorator) Wait(ctx context.Context) <-chan struct{} {
	return decorator.decorated.Wait(ctx)
}

type SliceEventIterator struct {
	events []*Event
	index  int64
}

func (iterator *SliceEventIterator) Next(ctx context.Context) bool {
	iterator.index++
	return iterator.index < int64(len(iterator.events))
}

func (iterator *SliceEventIterator) Event() *Event {
	return iterator.events[iterator.index]
}

func (iterator *SliceEventIterator) Err() error {
	return nil
}
