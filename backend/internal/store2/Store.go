package store2

import "context"

type ErrNotFound struct{}

func (err ErrNotFound) Error() string {
	return "key not found"
}

type Store[K comparable, V any] interface {
	Put(ctx context.Context, key K, value V) (err error)
	Get(ctx context.Context, key K) (value V, err error)
	Delete(ctx context.Context, key K) (err error)
}

type StoreInMemory[K comparable, V any] map[K]V

func (store StoreInMemory[K, V]) Put(ctx context.Context, key K, value V) (err error) {
	store[key] = value
	return nil
}

func (store StoreInMemory[K, V]) Get(ctx context.Context, key K) (value V, err error) {
	value, ok := store[key]
	if !ok {
		err = ErrNotFound{}
		return
	}
	return
}

func (store StoreInMemory[K, V]) Delete(ctx context.Context, key K) (err error) {
	delete(store, key)
	return
}
