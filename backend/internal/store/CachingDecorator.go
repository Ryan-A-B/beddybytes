package store

import "context"

type CachingDecorator struct {
	store Store
	// TODO: use LRU cache
	cache map[string][]byte
}

type NewCachingDecoratorInput struct {
	Store Store
}

func NewCachingDecorator(input *NewCachingDecoratorInput) *CachingDecorator {
	return &CachingDecorator{
		store: input.Store,
		cache: make(map[string][]byte),
	}
}

func (decorator *CachingDecorator) Put(ctx context.Context, key string, data []byte) (err error) {
	err = decorator.store.Put(ctx, key, data)
	if err != nil {
		return
	}
	decorator.cache[key] = data
	return
}

func (decorator *CachingDecorator) Get(ctx context.Context, key string) (data []byte, err error) {
	data, ok := decorator.cache[key]
	if ok {
		return
	}
	data, err = decorator.store.Get(ctx, key)
	if err != nil {
		return
	}
	decorator.cache[key] = data
	return
}

func (decorator *CachingDecorator) Delete(ctx context.Context, key string) (err error) {
	err = decorator.store.Delete(ctx, key)
	if err != nil {
		return
	}
	delete(decorator.cache, key)
	return
}
