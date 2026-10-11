package accountrepository

import (
	"context"
	"encoding/json"
	"errors"
	"sync"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/subscription"
)

var ErrAccountNotFound = errors.New("account not found")
var ErrPasswordRequired = errors.New("password required")

type QueryHandler struct {
	eventLog               eventlog.EventLog
	cursor                 int64
	mutex                  sync.Mutex
	accountIDForUser       map[UserID]string
	hashedPasswordForEmail map[string]HashedPassword
}

type NewQueryHandlerInput struct {
	EventLog eventlog.EventLog
}

func NewQueryHandler(input NewQueryHandlerInput) (handler *QueryHandler) {
	handler = &QueryHandler{
		eventLog:               input.EventLog,
		accountIDForUser:       make(map[UserID]string),
		hashedPasswordForEmail: make(map[string]HashedPassword),
	}
	return
}

func (handler *QueryHandler) GetAccountIDForUser(ctx context.Context, userID UserID) (accountID string, err error) {
	handler.mutex.Lock()
	defer handler.mutex.Unlock()
	err = handler.catchup(ctx)
	if err != nil {
		return
	}
	accountID, exists := handler.accountIDForUser[userID]
	if !exists {
		err = ErrUserNotFound
		return
	}
	return
}

type CheckCredentialsInput struct {
	Email    string
	Password string
}

func (input *CheckCredentialsInput) validate() (err error) {
	if input.Email == "" {
		err = ErrEmailRequired
		return
	}
	if input.Password == "" {
		err = ErrPasswordRequired
		return
	}
	if len(input.Password) < 20 {
		err = ErrInvalidPassword
		return
	}
	return nil
}

func (handler *QueryHandler) CheckCredentials(ctx context.Context, input CheckCredentialsInput) (err error) {
	err = input.validate()
	if err != nil {
		return
	}
	handler.mutex.Lock()
	defer handler.mutex.Unlock()
	err = handler.catchup(ctx)
	if err != nil {
		return
	}
	hashedPassword, exists := handler.hashedPasswordForEmail[input.Email]
	if !exists {
		err = ErrUserNotFound
		return
	}
	return hashedPassword.Verify(input.Password)
}

func (handler *QueryHandler) catchup(ctx context.Context) (err error) {
	handler.cursor, err = subscription.CatchUp(ctx, subscription.CatchUpInput{
		Log:    handler.eventLog,
		Cursor: handler.cursor,
		Apply:  handler.apply,
	})
	return
}

func (handler *QueryHandler) apply(ctx context.Context, event *eventlog.Event) {
	switch event.Type {
	case EventTypeAccountCreatedV1:
		handler.applyAccountCreatedV1(ctx, event)
	case EventTypeAccountCreatedV2:
		handler.applyAccountCreatedV2(ctx, event)
	case EventTypeAccountPasswordReset:
		handler.applyAccountPasswordReset(ctx, event)
	case EventTypeUserPasswordReset:
		handler.applyUserPasswordReset(ctx, event)
	}
}

func (handler *QueryHandler) applyAccountCreatedV1(ctx context.Context, event *eventlog.Event) {
	var detail AccountCreatedV1Detail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	userID := UserID{
		Issuer:  IssuerBeddybytes,
		Subject: detail.User.Email,
	}
	handler.accountIDForUser[userID] = detail.AccountID
	handler.hashedPasswordForEmail[detail.User.Email] = HashedPassword{
		Salt:   detail.User.PasswordSalt,
		Digest: detail.User.PasswordHash,
	}
}

func (handler *QueryHandler) applyAccountCreatedV2(ctx context.Context, event *eventlog.Event) {
	var detail AccountCreatedV2Detail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.accountIDForUser[detail.User.ID] = detail.AccountID
	if detail.User.ID.Issuer != IssuerBeddybytes {
		return
	}
	email := detail.User.ID.Subject
	handler.hashedPasswordForEmail[email] = *detail.User.HashedPassword
}

func (handler *QueryHandler) applyAccountPasswordReset(ctx context.Context, event *eventlog.Event) {
	var detail AccountPasswordResetDetail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.hashedPasswordForEmail[detail.Email] = HashedPassword{
		Salt:   detail.PasswordSalt,
		Digest: detail.PasswordHash,
	}
}

func (handler *QueryHandler) applyUserPasswordReset(ctx context.Context, event *eventlog.Event) {
	var detail UserPasswordResetDetail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.hashedPasswordForEmail[detail.Email] = detail.HashedPassword
}
