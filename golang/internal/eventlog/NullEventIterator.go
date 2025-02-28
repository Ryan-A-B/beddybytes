package eventlog

import "context"

type NullEventIterator struct{}

func (iterator *NullEventIterator) Next(ctx context.Context) bool {
	return false
}

func (iterator *NullEventIterator) Event() *Event {
	return nil
}

func (iterator *NullEventIterator) Err() error {
	return nil
}
