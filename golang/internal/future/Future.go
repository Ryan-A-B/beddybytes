package future

type Result[T any] struct {
	Value T
	Error error
}

type Future[T any] struct {
	result Result[T]
	readyC chan struct{}
}

func New[T any]() *Future[T] {
	return &Future[T]{
		readyC: make(chan struct{}),
	}
}

func (future *Future[T]) Resolve(result T, err error) {
	future.result = Result[T]{Value: result, Error: err}
	close(future.readyC)
}

func (future *Future[T]) Result() Result[T] {
	<-future.readyC
	return future.result
}
