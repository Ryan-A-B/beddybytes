package eventlog

import "context"

type CompositeEventIterator struct {
	iterators []EventIterator
	event     *Event
	head      int64
	err       error
}

func (iterator *CompositeEventIterator) Next(ctx context.Context) bool {
	firstIterator := iterator.iterators[0]
	if ok := firstIterator.Next(ctx); !ok {
		err := firstIterator.Err()
		if err != nil {
			iterator.err = err
			return false
		}
		iterators := iterator.iterators[1:]
		if len(iterators) == 0 {
			return false
		}
		iterator.iterators = iterators
		return iterator.Next(ctx)
	}
	event := firstIterator.Event()
	if event.LogicalClock < iterator.head {
		return iterator.Next(ctx)
	}
	iterator.event = event
	iterator.head = event.LogicalClock
	return true
}

func (iterator *CompositeEventIterator) Event() *Event {
	return iterator.event
}

func (iterator *CompositeEventIterator) Err() error {
	return iterator.err
}
