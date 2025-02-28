package eventlog

import (
	"context"
	"log"
	"sync"

	uuid "github.com/satori/go.uuid"
)

type FollowingDecorator struct {
	decorated  EventLog
	bufferSize int
	eventCByID sync.Map
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
	decorator.eventCByID.Range(func(_, eventC interface{}) bool {
		// TODO if follower is slow, this will block
		eventC.(chan *Event) <- event
		return true
	})
	return
}

func (decorator *FollowingDecorator) GetEventIterator(ctx context.Context, input *GetEventIteratorInput) EventIterator {
	id := uuid.NewV4().String()
	eventC := make(chan *Event, decorator.bufferSize)
	decorator.eventCByID.Store(id, eventC)
	go func() {
		<-ctx.Done()
		decorator.eventCByID.Delete(id)
		close(eventC)
	}()
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

func (iterator *FollowingEventIterator) Next(ctx context.Context) bool {
	select {
	case <-ctx.Done():
		return false
	default:
	}
	select {
	case event, ok := <-iterator.eventC:
		if !ok {
			return false
		}
		iterator.event = event
		return true
	case <-ctx.Done():
		return false
	}
}

func (iterator *FollowingEventIterator) Event() *Event {
	return iterator.event
}

func (iterator *FollowingEventIterator) Err() error {
	return nil
}
