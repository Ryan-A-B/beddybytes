package account

import (
	"context"

	"github.com/ryan/baby-monitor/backend/internal/fatal"
)

type ContextKey string

const (
	ContextKeyAccountID ContextKey = "accountID"
)

func ContextWithAccountID(ctx context.Context, accountID string) context.Context {
	return context.WithValue(ctx, ContextKeyAccountID, accountID)
}

func GetAccountIDFromContext(ctx context.Context) (accountID string) {
	accountID, ok := ctx.Value(ContextKeyAccountID).(string)
	fatal.Unless(ok, "accountID not found in context")
	return
}
