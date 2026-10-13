package future

type Future[T any] struct {
	result T
	err    error
	done   chan struct{}
}

func New[T any]() *Future[T] {
	return &Future[T]{
		done: make(chan struct{}),
	}
}

func (f *Future[T]) Resolve(result T, err error) {
	f.result = result
	f.err = err
	close(f.done)
}

func (f *Future[T]) Wait() (T, error) {
	<-f.done
	return f.result, f.err
}
