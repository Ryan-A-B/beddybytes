package paymentrepository

import (
	"context"
	"encoding/json"
	"errors"
	"sync"
	"time"

	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/future"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
	"github.com/Ryan-A-B/beddybytes/golang/internal/paymentrepository/internal/checkoutsessions"
	"github.com/Ryan-A-B/beddybytes/golang/internal/subscription"
)

var ErrAccountIDRequired = errors.New("account ID is required")
var ErrAccountIneligible = errors.New("account ineligible")
var ErrNoActiveSession = errors.New("no active session for account")
var ErrUnexpectedCheckoutSessionStatus = errors.New("unexpected checkout session status")
var ErrUnexpectedCheckoutSessionPaymentStatus = errors.New("unexpected checkout session payment status")
var ErrCheckoutSessionNotFound = errors.New("checkout session not found")
var ErrPaymentIntentNotExpanded = errors.New("expanded payment intent is required for unpaid checkout")

type CommandHandler struct {
	mutex                     sync.Mutex
	eventLog                  eventlog.EventLog
	cursor                    int64
	checkoutSessionRepository checkoutsessions.Repository

	eligibleAccounts     map[string]*models.License
	sessionInfoByAccount map[string]*CheckoutSessionInfo

	sessionInfoFutureForAccount map[string]*future.Future[*CheckoutSessionInfo]
	syncInProgress              map[string]struct{}
}

type CheckoutSessionInfo struct {
	AccountID         string
	CheckoutSessionID string
	CheckoutURL       string
	SessionExpiresAt  int64
}

func (info *CheckoutSessionInfo) HasExpired() bool {
	return info.SessionExpiresAt <= time.Now().Unix()
}

type NewCommandHandlerInput struct {
	EventLog                  eventlog.EventLog
	CheckoutSessionRepository checkoutsessions.Repository
}

func NewCommandHandler(input NewCommandHandlerInput) *CommandHandler {
	return &CommandHandler{
		eventLog:                  input.EventLog,
		checkoutSessionRepository: input.CheckoutSessionRepository,

		eligibleAccounts:     make(map[string]*models.License),
		sessionInfoByAccount: make(map[string]*CheckoutSessionInfo),

		sessionInfoFutureForAccount: make(map[string]*future.Future[*CheckoutSessionInfo]),
		syncInProgress:              make(map[string]struct{}),
	}
}

type StartCheckoutSessionInput struct {
	AccountID string
}

func (input StartCheckoutSessionInput) validate() (err error) {
	if input.AccountID == "" {
		err = ErrAccountIDRequired
	}
	return
}

type StartCheckoutSessionOutput struct {
	CheckoutSessionID string
	CheckoutURL       string
}

// TODO this is over complicated because I put the Create in a future instead of the full result.
func (handler *CommandHandler) StartCheckoutSession(ctx context.Context, input StartCheckoutSessionInput) (output *StartCheckoutSessionOutput, err error) {
	err = input.validate()
	if err != nil {
		return
	}
	preflightOutput, err := handler.startCheckoutSessionPreflight(ctx, input)
	if err != nil {
		return
	}
	if preflightOutput.startCheckoutSessionOutput != nil {
		output = preflightOutput.startCheckoutSessionOutput
		return
	}
	var sessionInfo *CheckoutSessionInfo
	if preflightOutput.futureAlreadyExisted {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-preflightOutput.sessionInfoFuture.Ready():
		}
		sessionInfo, err = preflightOutput.sessionInfoFuture.Result()
		if err != nil {
			return
		}
		output = &StartCheckoutSessionOutput{
			CheckoutSessionID: sessionInfo.CheckoutSessionID,
			CheckoutURL:       sessionInfo.CheckoutURL,
		}
		return
	}
	defer func() {
		if err != nil {
			handler.mutex.Lock()
			defer handler.mutex.Unlock()
			delete(handler.sessionInfoFutureForAccount, input.AccountID)
			preflightOutput.sessionInfoPromise.Resolve(nil, err)
		}
	}()
	// Stripe's default TTL is 24 hours
	session, err := handler.checkoutSessionRepository.Create(ctx, input.AccountID)
	if err != nil {
		return
	}
	sessionInfo = &CheckoutSessionInfo{
		CheckoutSessionID: session.ID,
		CheckoutURL:       session.URL,
		SessionExpiresAt:  session.ExpiresAt,
	}
	handler.mutex.Lock()
	defer handler.mutex.Unlock()
	delete(handler.sessionInfoFutureForAccount, input.AccountID)
	detail := events.StripeCheckoutSessionStartedDetail{
		SessionID:        session.ID,
		CheckoutURL:      session.URL,
		SessionExpiresAt: session.ExpiresAt,
	}
	data, err := json.Marshal(detail)
	fatal.OnError(err)
	_, err = handler.eventLog.Append(ctx, eventlog.AppendInput{
		Type:      events.TypeStripeCheckoutSessionStarted,
		AccountID: input.AccountID,
		Data:      data,
	})
	if err != nil {
		return
	}
	preflightOutput.sessionInfoPromise.Resolve(sessionInfo, nil)
	output = &StartCheckoutSessionOutput{
		CheckoutSessionID: session.ID,
		CheckoutURL:       session.URL,
	}
	return
}

type startCheckoutSessionPreflightOutput struct {
	startCheckoutSessionOutput *StartCheckoutSessionOutput
	sessionInfoFuture          *future.Future[*CheckoutSessionInfo]
	sessionInfoPromise         *future.Promise[*CheckoutSessionInfo]
	futureAlreadyExisted       bool
}

func (handler *CommandHandler) startCheckoutSessionPreflight(ctx context.Context, input StartCheckoutSessionInput) (output startCheckoutSessionPreflightOutput, err error) {
	handler.mutex.Lock()
	defer handler.mutex.Unlock()
	err = handler.catchup(ctx)
	if err != nil {
		return
	}
	if _, exists := handler.eligibleAccounts[input.AccountID]; !exists {
		return output, ErrAccountIneligible
	}

	sessionInfo, ok := handler.sessionInfoByAccount[input.AccountID]
	if ok {
		if !sessionInfo.HasExpired() {
			output = startCheckoutSessionPreflightOutput{
				startCheckoutSessionOutput: &StartCheckoutSessionOutput{
					CheckoutSessionID: sessionInfo.CheckoutSessionID,
					CheckoutURL:       sessionInfo.CheckoutURL,
				},
			}
			return
		}
		delete(handler.sessionInfoByAccount, input.AccountID)
	}
	sessionInfoFuture, futureAlreadyExisted := handler.sessionInfoFutureForAccount[input.AccountID]
	var sessionInfoPromise *future.Promise[*CheckoutSessionInfo]
	if !futureAlreadyExisted {
		sessionInfoPromise = future.NewPromise[*CheckoutSessionInfo]()
		sessionInfoFuture = sessionInfoPromise.Future()
		handler.sessionInfoFutureForAccount[input.AccountID] = sessionInfoFuture
	}
	output = startCheckoutSessionPreflightOutput{
		startCheckoutSessionOutput: nil,
		sessionInfoFuture:          sessionInfoFuture,
		sessionInfoPromise:         sessionInfoPromise,
		futureAlreadyExisted:       futureAlreadyExisted,
	}
	return
}

type RecordCheckoutSessionEventInput struct {
	Payload   []byte
	Signature string
}

func (handler *CommandHandler) RecordCheckoutSessionEvent(ctx context.Context, input RecordCheckoutSessionEventInput) (err error) {
	event, err := handler.checkoutSessionRepository.ConstructEvent(input.Payload, input.Signature)
	if err != nil {
		return
	}
	if !contains(checkoutSessionEventTypes, event.Type) {
		return
	}
	var session *stripe.CheckoutSession
	if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
		return err
	}
	if session == nil {
		return errors.New("checkout session payload must not be null")
	}
	// Reconcile current state so webhooks and polling follow the same path,
	// including when a webhook contains an older snapshot of the session.
	return handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: session.ID})
}

var checkoutSessionEventTypes = []stripe.EventType{
	stripe.EventTypeCheckoutSessionCompleted,
	stripe.EventTypeCheckoutSessionExpired,
	stripe.EventTypeCheckoutSessionAsyncPaymentFailed,
	stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded,
}

type SyncCheckoutSessionInput struct {
	CheckoutSessionID string
}

func (handler *CommandHandler) SyncCheckoutSession(ctx context.Context, input SyncCheckoutSessionInput) (err error) {
	preflightOutput, err := handler.syncCheckoutSessionPreflight(ctx, input)
	if err != nil {
		return err
	}
	if preflightOutput.syncInProgress {
		return
	}
	defer func() {
		handler.mutex.Lock()
		defer handler.mutex.Unlock()
		delete(handler.syncInProgress, input.CheckoutSessionID)
	}()
	session, err := handler.checkoutSessionRepository.Retrieve(ctx, input.CheckoutSessionID)
	if err != nil {
		return
	}
	err = handler.fulfillCheckout(ctx, session)
	if err != nil {
		return
	}
	return
}

type syncCheckoutSessionPreflightOutput struct {
	syncInProgress bool
}

func (handler *CommandHandler) syncCheckoutSessionPreflight(ctx context.Context, input SyncCheckoutSessionInput) (output syncCheckoutSessionPreflightOutput, err error) {
	handler.mutex.Lock()
	defer handler.mutex.Unlock()
	err = handler.catchup(ctx)
	if err != nil {
		return
	}
	if _, exists := handler.syncInProgress[input.CheckoutSessionID]; exists {
		output.syncInProgress = true
		return
	}
	handler.syncInProgress[input.CheckoutSessionID] = struct{}{}
	return
}

func (handler *CommandHandler) fulfillCheckout(ctx context.Context, session *stripe.CheckoutSession) error {
	accountID := session.ClientReferenceID
	if session.Status == stripe.CheckoutSessionStatusOpen {
		return nil
	}
	if session.Status == stripe.CheckoutSessionStatusExpired {
		return handler.revokeProvisionalLicense(ctx, accountID)
	}
	if session.Status != stripe.CheckoutSessionStatusComplete {
		return ErrUnexpectedCheckoutSessionStatus
	}
	switch session.PaymentStatus {
	case stripe.CheckoutSessionPaymentStatusPaid:
		return handler.grantPerpetualLicense(ctx, accountID)
	case stripe.CheckoutSessionPaymentStatusUnpaid:
		if session.PaymentIntent == nil || session.PaymentIntent.Status == "" {
			return ErrPaymentIntentNotExpanded
		}
		if session.PaymentIntent.Status == stripe.PaymentIntentStatusProcessing {
			return handler.grantProvisionalLicense(ctx, accountID)
		}
		return handler.revokeProvisionalLicense(ctx, accountID)
	default:
		return ErrUnexpectedCheckoutSessionPaymentStatus
	}
}

func (handler *CommandHandler) grantPerpetualLicense(ctx context.Context, accountID string) (err error) {
	handler.mutex.Lock()
	defer handler.mutex.Unlock()
	err = handler.catchup(ctx)
	if err != nil {
		return
	}
	if _, eligible := handler.eligibleAccounts[accountID]; !eligible {
		// A replayed perpetual grant removes eligibility. Repeated payment
		// confirmations must not grant again or fail after that removal.
		return
	}
	_, err = handler.eventLog.Append(ctx, eventlog.AppendInput{
		Type:      events.TypePerpetualLicenseGranted,
		AccountID: accountID,
		Data:      nil,
	})
	return
}

func (handler *CommandHandler) grantProvisionalLicense(ctx context.Context, accountID string) (err error) {
	handler.mutex.Lock()
	defer handler.mutex.Unlock()
	err = handler.catchup(ctx)
	if err != nil {
		return
	}
	license, exists := handler.eligibleAccounts[accountID]
	if !exists {
		return
	}
	if license.Type != models.LicenseTypeTrial {
		return
	}
	_, err = handler.eventLog.Append(ctx, eventlog.AppendInput{
		Type:      events.TypeProvisionalLicenseGranted,
		AccountID: accountID,
		Data:      nil,
	})
	return
}

func (handler *CommandHandler) revokeProvisionalLicense(ctx context.Context, accountID string) (err error) {
	handler.mutex.Lock()
	defer handler.mutex.Unlock()
	err = handler.catchup(ctx)
	if err != nil {
		return
	}
	license, exists := handler.eligibleAccounts[accountID]
	if !exists {
		return
	}
	if license.Type != models.LicenseTypeProvisional {
		return
	}
	_, err = handler.eventLog.Append(ctx, eventlog.AppendInput{
		Type:      events.TypeProvisionalLicenseRevoked,
		AccountID: accountID,
		Data:      nil,
	})
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
	case events.TypeAccountCreatedV2:
		handler.applyAccountCreatedV2(ctx, event)
	case events.TypePerpetualLicenseGranted:
		handler.applyPerpetualLicenseGranted(ctx, event)
	case events.TypeProvisionalLicenseGranted:
		handler.applyProvisionalLicenseGranted(ctx, event)
	case events.TypeProvisionalLicenseRevoked:
		handler.applyProvisionalLicenseRevoked(ctx, event)
	case events.TypeStripeCheckoutSessionStarted:
		handler.applyStripeCheckoutSessionStarted(ctx, event)
	}
}

func (handler *CommandHandler) applyAccountCreatedV2(ctx context.Context, event *eventlog.Event) {
	var detail events.AccountCreatedV2Detail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.eligibleAccounts[detail.AccountID] = &models.License{
		Type:             models.LicenseTypeTrial,
		StartUnixSeconds: event.UnixTimestamp,
	}
}

func (handler *CommandHandler) applyPerpetualLicenseGranted(ctx context.Context, event *eventlog.Event) {
	delete(handler.eligibleAccounts, event.AccountID)
}

func (handler *CommandHandler) applyProvisionalLicenseGranted(ctx context.Context, event *eventlog.Event) {
	license, eligible := handler.eligibleAccounts[event.AccountID]
	if !eligible || license.Type != models.LicenseTypeTrial {
		return
	}
	handler.eligibleAccounts[event.AccountID] = &models.License{
		Type:             models.LicenseTypeProvisional,
		StartUnixSeconds: event.UnixTimestamp,
		ProvisionalLicense: &models.ProvisionalLicense{
			TrialStartUnixSeconds: license.StartUnixSeconds,
		},
	}
}

func (handler *CommandHandler) applyProvisionalLicenseRevoked(ctx context.Context, event *eventlog.Event) {
	license, eligible := handler.eligibleAccounts[event.AccountID]
	if !eligible || license.Type != models.LicenseTypeProvisional {
		return
	}
	handler.eligibleAccounts[event.AccountID] = &models.License{
		Type:             models.LicenseTypeTrial,
		StartUnixSeconds: license.ProvisionalLicense.TrialStartUnixSeconds,
	}
}

func (handler *CommandHandler) applyStripeCheckoutSessionStarted(ctx context.Context, event *eventlog.Event) {
	var detail events.StripeCheckoutSessionStartedDetail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.sessionInfoByAccount[event.AccountID] = &CheckoutSessionInfo{
		CheckoutSessionID: detail.SessionID,
		CheckoutURL:       detail.CheckoutURL,
		SessionExpiresAt:  detail.SessionExpiresAt,
	}
}

func contains[T comparable](slice []T, item T) bool {
	for _, v := range slice {
		if v == item {
			return true
		}
	}
	return false
}
