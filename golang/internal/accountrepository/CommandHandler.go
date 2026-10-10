package accountrepository

import (
	"context"
	"encoding/json"
	"errors"
	"sync"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/subscription"
	uuid "github.com/satori/go.uuid"
)

const IssuerBeddybytes = "beddybytes"

const (
	EventTypeAccountCreatedV1     eventlog.EventType = "account.created"
	EventTypeAccountCreatedV2     eventlog.EventType = "account.created.v2"
	EventTypeAccountPasswordReset eventlog.EventType = "account.password_reset"
	EventTypeUserPasswordReset    eventlog.EventType = "user.password_reset"
)

var ErrUserAlreadyExists = errors.New("user already exists")
var ErrEmailRequired = errors.New("email is required")
var ErrIssuerRequired = errors.New("issuer is required")
var ErrSubjectRequired = errors.New("subject is required")
var ErrUserNotFound = errors.New("user not found")
var ErrPasswordTooShort = errors.New("password needs to be at least 20 characters long")

type UserV1 struct {
	ID           string `json:"id"`
	Email        string `json:"email"`
	PasswordSalt []byte `json:"password_salt"`
	PasswordHash []byte `json:"password_hash"`
}

type AccountCreatedV1Detail struct {
	AccountID string `json:"id"`
	User      UserV1 `json:"user"`
}

type UserID struct {
	Issuer  string
	Subject string
}

type User struct {
	ID             UserID          `json:"id"`
	Email          string          `json:"email"`           // can be empty if issuer is not beddybytes
	HashedPassword *HashedPassword `json:"hashed_password"` // only set when issuer is beddybytes
}

type Account struct {
	ID    string  `json:"id"`
	Users []*User `json:"users"`
}

type AccountCreatedV2Detail struct {
	AccountID string `json:"account_id"`
	User      User   `json:"user"`
}

type AccountPasswordResetDetail struct {
	Email        string `json:"email"`
	PasswordSalt []byte `json:"password_salt"`
	PasswordHash []byte `json:"password_hash"`
}

type UserPasswordResetDetail struct {
	Email          string         `json:"email"`
	HashedPassword HashedPassword `json:"hashed_password"`
}

type CommandHandler struct {
	eventLog eventlog.EventLog
	cursor   int64
	mutex    sync.Mutex
	users    map[UserID]struct{}
}

type NewCommandHandlerInput struct {
	EventLog eventlog.EventLog
}

func NewCommandHandler(input NewCommandHandlerInput) (handler *CommandHandler) {
	handler = &CommandHandler{
		eventLog: input.EventLog,
		users:    make(map[UserID]struct{}),
	}
	return
}

type CreateInput struct {
	UserID   UserID
	Email    string
	Password string
}

func (input *CreateInput) validate() (err error) {
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

func (handler *CommandHandler) Create(ctx context.Context, input CreateInput) (account *Account, err error) {
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
	user := User{
		ID: UserID{
			Issuer:  input.UserID.Issuer,
			Subject: input.UserID.Subject,
		},
		Email: input.Email,
	}
	if input.UserID.Issuer == IssuerBeddybytes {
		hashedPassword := NewHashedPassword(input.Password)
		user.HashedPassword = &hashedPassword
	}
	detail := AccountCreatedV2Detail{
		AccountID: uuid.NewV4().String(),
		User:      user,
	}
	data, err := json.Marshal(detail)
	fatal.OnError(err)
	_, err = handler.eventLog.Append(ctx, eventlog.AppendInput{
		Type: EventTypeAccountCreatedV2,
		Data: data,
	})
	if err != nil {
		return
	}
	account = &Account{
		ID:    detail.AccountID,
		Users: []*User{&user},
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
	userID := UserID{
		Issuer:  IssuerBeddybytes,
		Subject: input.Email,
	}
	if _, exists := handler.users[userID]; !exists {
		err = ErrUserNotFound
		return
	}
	hashedPassword := NewHashedPassword(input.Password)
	detail := UserPasswordResetDetail{
		Email:          input.Email,
		HashedPassword: hashedPassword,
	}
	data, err := json.Marshal(detail)
	fatal.OnError(err)
	_, err = handler.eventLog.Append(ctx, eventlog.AppendInput{
		Type: EventTypeUserPasswordReset,
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
	case EventTypeAccountCreatedV1:
		handler.applyAccountCreatedV1(ctx, event)
	case EventTypeAccountCreatedV2:
		handler.applyAccountCreatedV2(ctx, event)
	}
}

func (handler *CommandHandler) applyAccountCreatedV1(ctx context.Context, event *eventlog.Event) {
	var detail AccountCreatedV1Detail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	userID := UserID{
		Issuer:  IssuerBeddybytes,
		Subject: detail.User.Email,
	}
	handler.users[userID] = struct{}{}
}

func (handler *CommandHandler) applyAccountCreatedV2(ctx context.Context, event *eventlog.Event) {
	var detail AccountCreatedV2Detail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.users[detail.User.ID] = struct{}{}
}
