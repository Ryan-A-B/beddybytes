package syncx

import "sync/atomic"

type Promise[T any] struct {
	value    T
	err      error
	readyC   chan struct{}
	resolved atomic.Bool
}

func NewPromise[T any]() *Promise[T] {
	return &Promise[T]{readyC: make(chan struct{})}
}

func (promise *Promise[T]) Resolve(value T, err error) {
	if !promise.resolved.CompareAndSwap(false, true) {
		panic("future: promise already resolved")
	}
	promise.value = value
	promise.err = err
	close(promise.readyC)
}

func (promise *Promise[T]) Future() *Future[T] {
	return &Future[T]{promise: promise}
}

type Future[T any] struct {
	promise *Promise[T]
}

func (future *Future[T]) Ready() <-chan struct{} {
	return future.promise.readyC
}

func (future *Future[T]) Result() (T, error) {
	<-future.promise.readyC
	return future.promise.value, future.promise.err
}
