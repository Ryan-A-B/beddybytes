package eventlog

import (
	"context"
	"log"
)

type FollowingDecorator struct {
	decorated  EventLog
	bufferSize int
	eventCs    []chan *Event
}

type NewFollowingDecoratorInput struct {
	Decorated  EventLog
	BufferSize int
}

func NewFollowingDecorator(input *NewFollowingDecoratorInput) *FollowingDecorator {
	if input.BufferSize == 0 {
		log.Println("Warn: FollowingDecorator.BufferSize is 0")
	}
	return &FollowingDecorator{
		decorated:  input.Decorated,
		bufferSize: input.BufferSize,
	}
}

func (decorator *FollowingDecorator) Append(ctx context.Context, input *AppendInput) (event *Event, err error) {
	event, err = decorator.decorated.Append(ctx, input)
	if err != nil {
		return
	}
	for _, eventC := range decorator.eventCs {
		eventC <- event
	}
	return
}

func (decorator *FollowingDecorator) GetEventIterator(ctx context.Context, input *GetEventIteratorInput) EventIterator {
	eventC := make(chan *Event, decorator.bufferSize)
	decorator.eventCs = append(decorator.eventCs, eventC)
	return &CompositeEventIterator{
		iterators: []EventIterator{
			decorator.decorated.GetEventIterator(ctx, input),
			&FollowingEventIterator{
				eventC: eventC,
			},
		},
	}
}

type FollowingEventIterator struct {
	eventC chan *Event
	event  *Event
}

func (iterator *FollowingEventIterator) Next() bool {
	event, ok := <-iterator.eventC
	if !ok {
		return false
	}
	iterator.event = event
	return true
}

func (iterator *FollowingEventIterator) Event() *Event {
	return iterator.event
}

func (iterator *FollowingEventIterator) Err() error {
	return nil
}
