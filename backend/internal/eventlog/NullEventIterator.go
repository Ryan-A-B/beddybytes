package eventlog

type NullEventIterator struct{}

func (iterator *NullEventIterator) Next() bool {
	return false
}

func (iterator *NullEventIterator) Event() *Event {
	return nil
}

func (iterator *NullEventIterator) Err() error {
	return nil
}
