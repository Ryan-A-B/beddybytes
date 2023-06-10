package store

import "context"

type MemoryStore struct {
	store map[string][]byte
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		store: make(map[string][]byte),
	}
}

func (store *MemoryStore) Get(ctx context.Context, key string) (value []byte, err error) {
	value, ok := store.store[key]
	if !ok {
		err = ErrNotFound.Here()
	}
	return
}

func (store *MemoryStore) Put(ctx context.Context, key string, value []byte) (err error) {
	store.store[key] = value
	return
}

func (store *MemoryStore) Delete(ctx context.Context, key string) (err error) {
	delete(store.store, key)
	return
}
