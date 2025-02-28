package accounts

import (
	"context"
	"encoding/json"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
)

const EventTypeAccountCreated = "account.created"
const EventTypeAccountPasswordReset = "account.password_reset"

func (handlers *Handlers) ApplyEvent(ctx context.Context, event *eventlog.Event) {
	switch event.Type {
	case EventTypeAccountCreated:
		handlers.ApplyAccountCreatedEvent(ctx, event)
	case EventTypeAccountPasswordReset:
		handlers.ApplyAccountPasswordResetEvent(ctx, event)
	}
}

func (handlers *Handlers) ApplyAccountCreatedEvent(ctx context.Context, event *eventlog.Event) {
	var account Account
	err := json.Unmarshal(event.Data, &account)
	fatal.OnError(err)
	err = handlers.AccountStore.Put(ctx, &account)
	fatal.OnError(err)
}

type PasswordResetData struct {
	Email        string `json:"email"`
	PasswordSalt []byte `json:"password_salt"`
	PasswordHash []byte `json:"password_hash"`
}

func (handlers *Handlers) ApplyAccountPasswordResetEvent(ctx context.Context, event *eventlog.Event) {
	var data PasswordResetData
	err := json.Unmarshal(event.Data, &data)
	fatal.OnError(err)
	err = handlers.AccountStore.UpdatePassword(ctx, &UpdatePasswordInput{
		Email:        data.Email,
		PasswordSalt: data.PasswordSalt,
		PasswordHash: data.PasswordHash,
	})
	fatal.OnError(err)
}
