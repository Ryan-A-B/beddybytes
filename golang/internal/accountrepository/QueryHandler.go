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
)

var ErrAccountNotFound = errors.New("account not found")
var ErrPasswordRequired = errors.New("password required")
var ErrInvalidPassword = models.ErrInvalidPassword

type QueryHandler struct {
	eventLog               eventlog.EventLog
	cursor                 int64
	mutex                  sync.Mutex
	accountIDForUser       map[models.UserID]string
	licenseForAccount      map[string]models.License
	hashedPasswordForEmail map[string]models.HashedPassword
}

type NewQueryHandlerInput struct {
	EventLog eventlog.EventLog
}

func NewQueryHandler(input NewQueryHandlerInput) (handler *QueryHandler) {
	handler = &QueryHandler{
		eventLog:               input.EventLog,
		accountIDForUser:       make(map[models.UserID]string),
		licenseForAccount:      make(map[string]models.License),
		hashedPasswordForEmail: make(map[string]models.HashedPassword),
	}
	return
}

func (handler *QueryHandler) GetAccountIDForUser(ctx context.Context, userID models.UserID) (accountID string, err error) {
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

func (handler *QueryHandler) GetLicenseForAccount(ctx context.Context, accountID string) (*models.License, error) {
	handler.mutex.Lock()
	defer handler.mutex.Unlock()
	var err error
	err = handler.catchup(ctx)
	if err != nil {
		return nil, err
	}
	license, exists := handler.licenseForAccount[accountID]
	if !exists {
		return nil, ErrAccountNotFound
	}
	return &license, nil
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
	case events.TypeAccountCreatedV1:
		handler.applyAccountCreatedV1(ctx, event)
	case events.TypeAccountCreatedV2:
		handler.applyAccountCreatedV2(ctx, event)
	case events.TypeAccountPasswordReset:
		handler.applyAccountPasswordReset(ctx, event)
	case events.TypeUserPasswordReset:
		handler.applyUserPasswordReset(ctx, event)
	case events.TypePerpetualLicenseGranted:
		handler.applyPerpetualLicenseGranted(ctx, event)
	case events.TypeProvisionalLicenseGranted:
		handler.applyProvisionalLicenseGranted(ctx, event)
	case events.TypeProvisionalLicenseRevoked:
		handler.applyProvisionalLicenseRevoked(ctx, event)
	}
}

func (handler *QueryHandler) applyAccountCreatedV1(ctx context.Context, event *eventlog.Event) {
	var detail events.AccountCreatedV1Detail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	userID := models.UserID{
		Issuer:  IssuerBeddybytes,
		Subject: detail.User.Email,
	}
	handler.accountIDForUser[userID] = detail.AccountID
	handler.licenseForAccount[detail.AccountID] = models.License{
		Type:             models.LicenseTypePerpetual,
		StartUnixSeconds: event.UnixTimestamp,
	}
	handler.hashedPasswordForEmail[detail.User.Email] = models.HashedPassword{
		Salt:   detail.User.PasswordSalt,
		Digest: detail.User.PasswordHash,
	}
}

func (handler *QueryHandler) applyAccountCreatedV2(ctx context.Context, event *eventlog.Event) {
	var detail events.AccountCreatedV2Detail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.accountIDForUser[detail.User.ID] = detail.AccountID
	handler.licenseForAccount[detail.AccountID] = models.License{
		Type:             models.LicenseTypeTrial,
		StartUnixSeconds: event.UnixTimestamp,
	}
	if detail.User.ID.Issuer == IssuerBeddybytes {
		email := detail.User.ID.Subject
		handler.hashedPasswordForEmail[email] = *detail.User.HashedPassword
	}
}

func (handler *QueryHandler) applyAccountPasswordReset(ctx context.Context, event *eventlog.Event) {
	var detail events.AccountPasswordResetDetail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.hashedPasswordForEmail[detail.Email] = models.HashedPassword{
		Salt:   detail.PasswordSalt,
		Digest: detail.PasswordHash,
	}
}

func (handler *QueryHandler) applyUserPasswordReset(ctx context.Context, event *eventlog.Event) {
	var detail events.UserPasswordResetDetail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.hashedPasswordForEmail[detail.Email] = detail.HashedPassword
}

func (handler *QueryHandler) applyPerpetualLicenseGranted(ctx context.Context, event *eventlog.Event) {
	handler.licenseForAccount[event.AccountID] = models.License{
		Type:             models.LicenseTypePerpetual,
		StartUnixSeconds: event.UnixTimestamp,
	}
}

func (handler *QueryHandler) applyProvisionalLicenseGranted(ctx context.Context, event *eventlog.Event) {
	license := handler.licenseForAccount[event.AccountID]
	handler.licenseForAccount[event.AccountID] = models.License{
		Type:             models.LicenseTypeProvisional,
		StartUnixSeconds: event.UnixTimestamp,
		ProvisionalLicense: &models.ProvisionalLicense{
			TrialStartUnixSeconds: license.StartUnixSeconds,
		},
	}
}

func (handler *QueryHandler) applyProvisionalLicenseRevoked(ctx context.Context, event *eventlog.Event) {
	license := handler.licenseForAccount[event.AccountID]
	handler.licenseForAccount[event.AccountID] = models.License{
		Type:             models.LicenseTypeTrial,
		StartUnixSeconds: license.ProvisionalLicense.TrialStartUnixSeconds,
	}
}
