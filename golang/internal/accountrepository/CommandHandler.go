package accountrepository

import (
	"context"
	"encoding/json"
	"errors"
	"sync"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
	"github.com/Ryan-A-B/beddybytes/golang/internal/subscription"
	uuid "github.com/satori/go.uuid"
)

const IssuerBeddybytes = "beddybytes"

var ErrUserAlreadyExists = errors.New("user already exists")
var ErrEmailRequired = errors.New("email is required")
var ErrIssuerRequired = errors.New("issuer is required")
var ErrSubjectRequired = errors.New("subject is required")
var ErrUserNotFound = errors.New("user not found")
var ErrPasswordTooShort = errors.New("password needs to be at least 20 characters long")

type CommandHandler struct {
	eventLog eventlog.EventLog
	cursor   int64
	mutex    sync.Mutex
	users    map[models.UserID]struct{}
}

type NewCommandHandlerInput struct {
	EventLog eventlog.EventLog
}

func NewCommandHandler(input NewCommandHandlerInput) (handler *CommandHandler) {
	handler = &CommandHandler{
		eventLog: input.EventLog,
		users:    make(map[models.UserID]struct{}),
	}
	return
}

type CreateAccountInput struct {
	UserID   models.UserID
	Email    string
	Password string
}

func (input *CreateAccountInput) validate() (err error) {
	if input.UserID.Issuer == "" {
		err = ErrIssuerRequired
		return
	}
	if input.UserID.Subject == "" {
		err = ErrSubjectRequired
		return
	}
	if input.UserID.Issuer == IssuerBeddybytes {
		if input.Email == "" {
			err = ErrEmailRequired
			return
		}
		if len(input.Password) < 20 {
			err = ErrPasswordTooShort
			return
		}
	}
	return nil
}

func (handler *CommandHandler) CreateAccount(ctx context.Context, input CreateAccountInput) (account *models.Account, err error) {
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
	if _, exists := handler.users[input.UserID]; exists {
		err = ErrUserAlreadyExists
		return
	}
	user := models.User{
		ID: models.UserID{
			Issuer:  input.UserID.Issuer,
			Subject: input.UserID.Subject,
		},
		Email: input.Email,
	}
	if input.UserID.Issuer == IssuerBeddybytes {
		hashedPassword := models.New(input.Password)
		user.HashedPassword = &hashedPassword
	}
	detail := events.AccountCreatedV2Detail{
		AccountID: uuid.NewV4().String(),
		User:      user,
	}
	data, err := json.Marshal(detail)
	fatal.OnError(err)
	var event *eventlog.Event
	event, err = handler.eventLog.Append(ctx, eventlog.AppendInput{
		Type: events.TypeAccountCreatedV2,
		Data: data,
	})
	if err != nil {
		return
	}
	account = &models.Account{
		ID:      detail.AccountID,
		License: models.NewTrialLicense(event.UnixTimestamp),
		Users:   []*models.User{&user},
	}
	return
}

type ResetPasswordInput struct {
	Email    string
	Password string
}

func (input *ResetPasswordInput) validate() (err error) {
	if input.Email == "" {
		err = ErrEmailRequired
		return
	}
	if len(input.Password) < 20 {
		err = ErrPasswordTooShort
		return
	}
	return nil
}

func (handler *CommandHandler) ResetPassword(ctx context.Context, input ResetPasswordInput) (err error) {
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
	userID := models.UserID{
		Issuer:  IssuerBeddybytes,
		Subject: input.Email,
	}
	if _, exists := handler.users[userID]; !exists {
		err = ErrUserNotFound
		return
	}
	hashedPassword := models.New(input.Password)
	detail := events.UserPasswordResetDetail{
		Email:          input.Email,
		HashedPassword: hashedPassword,
	}
	data, err := json.Marshal(detail)
	fatal.OnError(err)
	_, err = handler.eventLog.Append(ctx, eventlog.AppendInput{
		Type: events.TypeUserPasswordReset,
		Data: data,
	})
	if err != nil {
		return
	}
	return
}

func (handler *CommandHandler) catchup(ctx context.Context) (err error) {
	handler.cursor, err = subscription.CatchUp(ctx, subscription.CatchUpInput{
		Log:    handler.eventLog,
		Cursor: handler.cursor,
		Apply:  handler.apply,
	})
	return
}

func (handler *CommandHandler) apply(ctx context.Context, event *eventlog.Event) {
	switch event.Type {
	case events.TypeAccountCreatedV1:
		handler.applyAccountCreatedV1(ctx, event)
	case events.TypeAccountCreatedV2:
		handler.applyAccountCreatedV2(ctx, event)
	}
}

func (handler *CommandHandler) applyAccountCreatedV1(ctx context.Context, event *eventlog.Event) {
	var detail events.AccountCreatedV1Detail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	userID := models.UserID{
		Issuer:  IssuerBeddybytes,
		Subject: detail.User.Email,
	}
	handler.users[userID] = struct{}{}
}

func (handler *CommandHandler) applyAccountCreatedV2(ctx context.Context, event *eventlog.Event) {
	var detail events.AccountCreatedV2Detail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.users[detail.User.ID] = struct{}{}
}
