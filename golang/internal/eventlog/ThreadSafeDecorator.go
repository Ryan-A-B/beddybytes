package eventlog

import (
	"context"
	"sync"
)

type ThreadSafeDecorator struct {
	decorated EventLog
	mutex     sync.Mutex
}

type NewThreadSafeDecoratorInput struct {
	Decorated EventLog
}

func NewThreadSafeDecorator(input *NewThreadSafeDecoratorInput) *ThreadSafeDecorator {
	return &ThreadSafeDecorator{
		decorated: input.Decorated,
	}
}

func (decorator *ThreadSafeDecorator) Append(ctx context.Context, input AppendInput) (event *Event, err error) {
	decorator.mutex.Lock()
	defer decorator.mutex.Unlock()
	return decorator.decorated.Append(ctx, input)
}

func (decorator *ThreadSafeDecorator) GetEventIterator(ctx context.Context, input GetEventIteratorInput) EventIterator {
	decorator.mutex.Lock()
	defer decorator.mutex.Unlock()
	return decorator.decorated.GetEventIterator(ctx, input)
}

func (decorator *ThreadSafeDecorator) Wait(ctx context.Context) <-chan struct{} {
	decorator.mutex.Lock()
	defer decorator.mutex.Unlock()
	return decorator.decorated.Wait(ctx)
}
