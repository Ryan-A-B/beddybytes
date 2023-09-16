package store2

import (
	"context"
	"encoding"
)

type BinaryEncodable interface {
	encoding.BinaryMarshaler
	encoding.BinaryUnmarshaler
}

type BinaryEncodingDecorator[K comparable, V BinaryEncodable] struct {
	Decorated Store[K, []byte]
}

func (decorator BinaryEncodingDecorator[K, V]) Put(ctx context.Context, key K, value V) (err error) {
	bytes, err := value.MarshalBinary()
	if err != nil {
		return
	}
	return decorator.Decorated.Put(ctx, key, bytes)
}

func (decorator BinaryEncodingDecorator[K, V]) Get(ctx context.Context, key K) (value V, err error) {
	bytes, err := decorator.Decorated.Get(ctx, key)
	if err != nil {
		return
	}
	err = value.UnmarshalBinary(bytes)
	return
}

func (decorator BinaryEncodingDecorator[K, V]) Delete(ctx context.Context, key K) (err error) {
	return decorator.Decorated.Delete(ctx, key)
}
