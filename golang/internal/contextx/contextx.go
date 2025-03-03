package contextx

import (
	"context"

	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
)

type ContextKey string

const (
	ContextKeyAccountID ContextKey = "accountID"
)

func WithAccountID(ctx context.Context, accountID string) context.Context {
	return context.WithValue(ctx, ContextKeyAccountID, accountID)
}

func GetAccountID(ctx context.Context) (accountID string) {
	accountID, ok := ctx.Value(ContextKeyAccountID).(string)
	fatal.Unless(ok, "accountID not found in context")
	return
}
