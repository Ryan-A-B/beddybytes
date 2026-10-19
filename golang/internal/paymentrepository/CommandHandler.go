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
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
	"github.com/Ryan-A-B/beddybytes/golang/internal/paymentrepository/internal/checkoutsessions"
	"github.com/Ryan-A-B/beddybytes/golang/internal/subscription"
	"github.com/Ryan-A-B/beddybytes/golang/internal/syncx"
)

var ErrAccountIDRequired = errors.New("account ID is required")
var ErrAccountIneligible = errors.New("account ineligible")
var ErrNoActiveSession = errors.New("no active session for account")
var ErrUnexpectedCheckoutSessionStatus = errors.New("unexpected checkout session status")
var ErrUnexpectedCheckoutSessionPaymentStatus = errors.New("unexpected checkout session payment status")
var ErrCheckoutSessionNotFound = errors.New("checkout session not found")
var ErrPaymentIntentNotExpanded = errors.New("expanded payment intent is required for unpaid checkout")
var ErrLicenseNotProvisional = errors.New("license is not provisional")

type CommandHandler struct {
	mutex                     sync.Mutex
	eventLog                  eventlog.EventLog
	cursor                    int64
	checkoutSessionRepository checkoutsessions.Repository

	eligibleAccounts     map[string]*models.License
	sessionInfoByAccount map[string]*CheckoutSessionInfo
	sessionIDs           map[string]struct{}

	startCheckoutSessionFutureForAccount   map[string]*syncx.Future[*StartCheckoutSessionOutput]
	coalescingSyncQueueByCheckoutSessionID map[string]*CoalescingSyncQueue
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
		sessionIDs:           make(map[string]struct{}),

		startCheckoutSessionFutureForAccount:   make(map[string]*syncx.Future[*StartCheckoutSessionOutput]),
		coalescingSyncQueueByCheckoutSessionID: make(map[string]*CoalescingSyncQueue),
	}
}

type CoalescingSyncQueue struct {
	current *syncx.Future[struct{}]
	next    *syncx.Future[struct{}]
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

func (handler *CommandHandler) StartCheckoutSession(ctx context.Context, input StartCheckoutSessionInput) (output *StartCheckoutSessionOutput, err error) {
	handler.mutex.Lock()
	if pending, exists := handler.startCheckoutSessionFutureForAccount[input.AccountID]; exists {
		handler.mutex.Unlock()
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-pending.Ready():
			return pending.Result()
		}
	}
	promise := syncx.NewPromise[*StartCheckoutSessionOutput]()
	handler.startCheckoutSessionFutureForAccount[input.AccountID] = promise.Future()
	handler.mutex.Unlock()
	defer func() {
		handler.mutex.Lock()
		defer handler.mutex.Unlock()
		promise.Resolve(output, err)
		delete(handler.startCheckoutSessionFutureForAccount, input.AccountID)
	}()
	return handler.startCheckoutSession(ctx, input)
}

func (handler *CommandHandler) startCheckoutSession(ctx context.Context, input StartCheckoutSessionInput) (*StartCheckoutSessionOutput, error) {
	if err := input.validate(); err != nil {
		return nil, err
	}
	output, err := handler.startCheckoutSessionPreflight(ctx, input)
	if err != nil || output != nil {
		return output, err
	}
	// Stripe's default TTL is 24 hours.
	session, err := handler.checkoutSessionRepository.Create(ctx, input.AccountID)
	if err != nil {
		return nil, err
	}
	handler.mutex.Lock()
	defer handler.mutex.Unlock()
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
		return nil, err
	}
	return &StartCheckoutSessionOutput{
		CheckoutSessionID: session.ID,
		CheckoutURL:       session.URL,
	}, nil
}

func (handler *CommandHandler) startCheckoutSessionPreflight(ctx context.Context, input StartCheckoutSessionInput) (*StartCheckoutSessionOutput, error) {
	handler.mutex.Lock()
	defer handler.mutex.Unlock()
	if err := handler.catchup(ctx); err != nil {
		return nil, err
	}
	if _, exists := handler.eligibleAccounts[input.AccountID]; !exists {
		return nil, ErrAccountIneligible
	}
	if sessionInfo, exists := handler.sessionInfoByAccount[input.AccountID]; exists {
		if !sessionInfo.HasExpired() {
			return &StartCheckoutSessionOutput{
				CheckoutSessionID: sessionInfo.CheckoutSessionID,
				CheckoutURL:       sessionInfo.CheckoutURL,
			}, nil
		}
		delete(handler.sessionInfoByAccount, input.AccountID)
	}
	return nil, nil
}

type RecordCheckoutSessionEventInput struct {
	Payload   []byte
	Signature string
}

func (handler *CommandHandler) RecordCheckoutSessionEvent(ctx context.Context, input RecordCheckoutSessionEventInput) error {
	notification, err := handler.checkoutSessionRepository.ParseNotification(input.Payload, input.Signature)
	if err != nil {
		return err
	}
	if notification == nil {
		return nil
	}
	return handler.SyncCheckoutSession(ctx, SyncCheckoutSessionInput{CheckoutSessionID: notification.CheckoutSessionID})
}

type SyncCheckoutSessionInput struct {
	CheckoutSessionID string
}

func (handler *CommandHandler) SyncCheckoutSession(ctx context.Context, input SyncCheckoutSessionInput) (err error) {
	var future *syncx.Future[struct{}]
	syncx.WithLock(&handler.mutex, func() {
		err = handler.catchup(ctx)
		if err != nil {
			return
		}
		if _, exists := handler.sessionIDs[input.CheckoutSessionID]; !exists {
			err = ErrCheckoutSessionNotFound
			return
		}
		coalescingSyncQueue, ok := handler.coalescingSyncQueueByCheckoutSessionID[input.CheckoutSessionID]
		if !ok {
			promise := syncx.NewPromise[struct{}]()
			coalescingSyncQueue = &CoalescingSyncQueue{
				current: promise.Future(),
			}
			handler.coalescingSyncQueueByCheckoutSessionID[input.CheckoutSessionID] = coalescingSyncQueue
			go func() {
				ctx := context.Background()
				err := handler.syncCheckoutSession(ctx, input.CheckoutSessionID)
				promise.Resolve(struct{}{}, err)
			}()
			future = promise.Future()
			return
		}
		if coalescingSyncQueue.next == nil {
			promise := syncx.NewPromise[struct{}]()
			coalescingSyncQueue.next = promise.Future()
			current := coalescingSyncQueue.current
			go func() {
				ctx := context.Background()
				<-current.Ready()
				syncx.WithLock(&handler.mutex, func() {
					coalescingSyncQueue.current = coalescingSyncQueue.next
					coalescingSyncQueue.next = nil
				})
				err := handler.syncCheckoutSession(ctx, input.CheckoutSessionID)
				promise.Resolve(struct{}{}, err)
			}()
			future = promise.Future()
			return
		}
		future = coalescingSyncQueue.next
	})
	if err != nil {
		return err
	}
	_, err = future.Result()
	return err
}

func (handler *CommandHandler) syncCheckoutSession(ctx context.Context, checkoutSessionID string) error {
	session, err := handler.checkoutSessionRepository.Retrieve(ctx, checkoutSessionID)
	if err != nil {
		return err
	}
	return handler.fulfillCheckout(ctx, session)
}

func validateSession(session *stripe.CheckoutSession) error {
	if session == nil {
		return errors.New("checkout session is required")
	}
	switch session.Status {
	case stripe.CheckoutSessionStatusOpen, stripe.CheckoutSessionStatusExpired:
		return nil
	case stripe.CheckoutSessionStatusComplete:
	default:
		return ErrUnexpectedCheckoutSessionStatus
	}
	switch session.PaymentStatus {
	case stripe.CheckoutSessionPaymentStatusPaid:
		return nil
	case stripe.CheckoutSessionPaymentStatusUnpaid:
		if session.PaymentIntent == nil || session.PaymentIntent.Status == "" {
			return ErrPaymentIntentNotExpanded
		}
		return nil
	default:
		return ErrUnexpectedCheckoutSessionPaymentStatus
	}
}

func (handler *CommandHandler) fulfillCheckout(ctx context.Context, session *stripe.CheckoutSession) error {
	if err := validateSession(session); err != nil {
		return err
	}
	if session.Status != stripe.CheckoutSessionStatusComplete {
		return nil
	}
	accountID := session.ClientReferenceID
	if session.PaymentStatus == stripe.CheckoutSessionPaymentStatusPaid {
		return handler.grantPerpetualLicense(ctx, accountID, session.ID)
	}
	if session.PaymentIntent.Status == stripe.PaymentIntentStatusProcessing {
		return handler.grantProvisionalLicense(ctx, accountID, session.ID)
	}
	err := handler.revokeProvisionalLicense(ctx, accountID, session.ID)
	if errors.Is(err, ErrLicenseNotProvisional) {
		return handler.endCheckoutSession(ctx, accountID, session.ID)
	}
	return err
}

func (handler *CommandHandler) grantPerpetualLicense(ctx context.Context, accountID string, sessionID string) (err error) {
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
		Data:      fatal.UnlessMarshalJSON(events.LicenseEventDetail{StripeCheckoutSessionID: sessionID}),
	})
	return
}

func (handler *CommandHandler) grantProvisionalLicense(ctx context.Context, accountID string, sessionID string) (err error) {
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
		Data:      fatal.UnlessMarshalJSON(events.LicenseEventDetail{StripeCheckoutSessionID: sessionID}),
	})
	return
}

func (handler *CommandHandler) revokeProvisionalLicense(ctx context.Context, accountID string, sessionID string) (err error) {
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
		return ErrLicenseNotProvisional
	}
	_, err = handler.eventLog.Append(ctx, eventlog.AppendInput{
		Type:      events.TypeProvisionalLicenseRevoked,
		AccountID: accountID,
		Data:      fatal.UnlessMarshalJSON(events.LicenseEventDetail{StripeCheckoutSessionID: sessionID}),
	})
	return
}

func (handler *CommandHandler) endCheckoutSession(ctx context.Context, accountID string, sessionID string) (err error) {
	handler.mutex.Lock()
	defer handler.mutex.Unlock()
	err = handler.catchup(ctx)
	if err != nil {
		return
	}
	// An ended checkout has no pending info. Match the ID so an older
	// checkout cannot close a newer attempt.
	sessionInfo, pending := handler.sessionInfoByAccount[accountID]
	if !pending || sessionInfo.CheckoutSessionID != sessionID {
		return nil
	}
	_, err = handler.eventLog.Append(ctx, eventlog.AppendInput{
		Type:      events.TypeStripeCheckoutSessionEnded,
		AccountID: accountID,
		Data:      fatal.UnlessMarshalJSON(events.StripeCheckoutSessionEndedDetail{SessionID: sessionID}),
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
	case events.TypeStripeCheckoutSessionEnded:
		var detail events.StripeCheckoutSessionEndedDetail
		fatal.OnError(json.Unmarshal(event.Data, &detail))
		handler.removeSessionInfo(event.AccountID, detail.SessionID)
	}
}

func (handler *CommandHandler) applyAccountCreatedV2(ctx context.Context, event *eventlog.Event) {
	var detail events.AccountCreatedV2Detail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	license := models.NewTrialLicense(event.UnixTimestamp)
	handler.eligibleAccounts[detail.AccountID] = &license
}

func (handler *CommandHandler) applyPerpetualLicenseGranted(ctx context.Context, event *eventlog.Event) {
	var detail events.LicenseEventDetail
	fatal.OnError(json.Unmarshal(event.Data, &detail))
	handler.removeSessionInfo(event.AccountID, detail.StripeCheckoutSessionID)
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
	var detail events.LicenseEventDetail
	fatal.OnError(json.Unmarshal(event.Data, &detail))
	handler.removeSessionInfo(event.AccountID, detail.StripeCheckoutSessionID)
	license, eligible := handler.eligibleAccounts[event.AccountID]
	if !eligible || license.Type != models.LicenseTypeProvisional {
		return
	}
	trialLicense := models.NewTrialLicense(license.ProvisionalLicense.TrialStartUnixSeconds)
	handler.eligibleAccounts[event.AccountID] = &trialLicense
}

func (handler *CommandHandler) applyStripeCheckoutSessionStarted(ctx context.Context, event *eventlog.Event) {
	var detail events.StripeCheckoutSessionStartedDetail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.sessionIDs[detail.SessionID] = struct{}{}
	handler.sessionInfoByAccount[event.AccountID] = &CheckoutSessionInfo{
		CheckoutSessionID: detail.SessionID,
		CheckoutURL:       detail.CheckoutURL,
		SessionExpiresAt:  detail.SessionExpiresAt,
	}
}

func (handler *CommandHandler) removeSessionInfo(accountID string, sessionID string) {
	// sessionIDs should be removed after a grace period.
	if sessionInfo, exists := handler.sessionInfoByAccount[accountID]; exists && sessionInfo.CheckoutSessionID == sessionID {
		delete(handler.sessionInfoByAccount, accountID)
	}
}
