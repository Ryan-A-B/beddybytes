package store2

import (
	"context"
	"encoding/json"
)

type JSONEncodingDecorator[K comparable, V any] struct {
	Decorated Store[K, []byte]
}

func (decorator JSONEncodingDecorator[K, V]) Put(ctx context.Context, key K, value V) (err error) {
	bytes, err := json.Marshal(value)
	if err != nil {
		return
	}
	return decorator.Decorated.Put(ctx, key, bytes)
}

func (decorator JSONEncodingDecorator[K, V]) Get(ctx context.Context, key K) (value V, err error) {
	bytes, err := decorator.Decorated.Get(ctx, key)
	if err != nil {
		return
	}
	err = json.Unmarshal(bytes, &value)
	return
}

func (decorator JSONEncodingDecorator[K, V]) Delete(ctx context.Context, key K) (err error) {
	return decorator.Decorated.Delete(ctx, key)
}
