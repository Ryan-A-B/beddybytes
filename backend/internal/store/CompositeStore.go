package store

import (
	"context"
	"net/http"

	"github.com/ansel1/merry"

	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
)

type CompositeStore struct {
	Stores []Store
}

func (compositeStore *CompositeStore) Put(ctx context.Context, key string, data []byte) (err error) {
	for _, store := range compositeStore.Stores {
		err = store.Put(ctx, key, data)
		if err != nil {
			return
		}
	}
	return
}

func (compositeStore *CompositeStore) Get(ctx context.Context, key string) (data []byte, err error) {
	for _, store := range compositeStore.Stores {
		data, err = store.Get(ctx, key)
		if err == nil {
			return
		}
		fatal.Unless(merry.HTTPCode(err) == http.StatusNotFound, "unexpected error: "+err.Error())
	}
	return
}

func (compositeStore *CompositeStore) Delete(ctx context.Context, key string) (err error) {
	for _, store := range compositeStore.Stores {
		err = store.Delete(ctx, key)
		if err != nil {
			return
		}
	}
	return
}
