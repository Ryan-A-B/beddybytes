package store

import (
	"context"
	"net/http"

	"github.com/ansel1/merry"
)

var ErrNotFound = merry.New("key not found").WithHTTPCode(http.StatusNotFound)

type Store interface {
	Put(ctx context.Context, key string, data []byte) (err error)
	Get(ctx context.Context, key string) (data []byte, err error)
	Delete(ctx context.Context, key string) (err error)
}
