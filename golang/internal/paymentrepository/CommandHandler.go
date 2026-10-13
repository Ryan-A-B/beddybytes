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
	"github.com/Ryan-A-B/beddybytes/golang/internal/subscription"
)

var ErrAccountIDRequired = errors.New("account ID is required")
var ErrAccountNotFound = errors.New("account not found")
var ErrNoActiveSession = errors.New("no active session for account")

type CommandHandler struct {
	mutex         sync.Mutex
	eventLog      eventlog.EventLog
	cursor        int64
	stripe        *stripe.Client
	webhookSecret string
	priceID       string
	successURL    string
	cancelURL     string

	trialAccountIDs             map[string]struct{}
	sessionInfoForAccount       map[string]*CheckoutSessionInfo
	sessionInfoFutureForAccount map[string]*future.Future[*CheckoutSessionInfo]
}

type CheckoutSessionInfo struct {
	CheckoutSessionID string
	CheckoutURL       string
	SessionExpiresAt  int64
}

func (info *CheckoutSessionInfo) HasExpired() bool {
	return info.SessionExpiresAt <= time.Now().Unix()
}

type NewCommandHandlerInput struct {
	EventLog      eventlog.EventLog
	Stripe        *stripe.Client
	PriceID       string
	WebhookSecret string
	SuccessURL    string
	CancelURL     string
}

func NewCommandHandler(input NewCommandHandlerInput) *CommandHandler {
	return &CommandHandler{
		eventLog:      input.EventLog,
		stripe:        input.Stripe,
		priceID:       input.PriceID,
		webhookSecret: input.WebhookSecret,
		successURL:    input.SuccessURL,
		cancelURL:     input.CancelURL,

		trialAccountIDs:             make(map[string]struct{}),
		sessionInfoForAccount:       make(map[string]*CheckoutSessionInfo),
		sessionInfoFutureForAccount: make(map[string]*future.Future[*CheckoutSessionInfo]),
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

func (handler *CommandHandler) StartCheckoutSession(ctx context.Context, input StartCheckoutSessionInput) (output *StartCheckoutSessionOutput, err error) {
	err = input.validate()
	if err != nil {
		return
	}
	var sessionInfoFuture *future.Future[*CheckoutSessionInfo]
	var futureAlreadyExisted bool
	func() {
		handler.mutex.Lock()
		defer handler.mutex.Unlock()
		err = handler.catchup(ctx)
		if err != nil {
			return
		}
		sessionInfo, ok := handler.sessionInfoForAccount[input.AccountID]
		if ok {
			if !sessionInfo.HasExpired() {
				output = &StartCheckoutSessionOutput{
					CheckoutSessionID: sessionInfo.CheckoutSessionID,
					CheckoutURL:       sessionInfo.CheckoutURL,
				}
				return
			}
			delete(handler.sessionInfoForAccount, input.AccountID)
		}
		sessionInfoFuture, futureAlreadyExisted := handler.sessionInfoFutureForAccount[input.AccountID]
		if !futureAlreadyExisted {
			sessionInfoFuture = future.New[*CheckoutSessionInfo]()
			handler.sessionInfoFutureForAccount[input.AccountID] = sessionInfoFuture
		}
	}()
	if err != nil {
		return
	}
	if output != nil {
		return
	}
	var sessionInfo *CheckoutSessionInfo
	if futureAlreadyExisted {
		sessionInfo, err = sessionInfoFuture.Wait()
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
			sessionInfoFuture.Resolve(nil, err)
		}
	}()
	session, err := handler.stripe.V1CheckoutSessions.Create(ctx, &stripe.CheckoutSessionCreateParams{
		Mode: stripe.String("payment"),
		LineItems: []*stripe.CheckoutSessionCreateLineItemParams{
			{
				Price:    stripe.String(handler.priceID),
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL: stripe.String(handler.successURL),
		CancelURL:  stripe.String(handler.cancelURL),
	})
	if err != nil {
		return
	}
	sessionInfo = &CheckoutSessionInfo{
		CheckoutSessionID: session.ID,
		CheckoutURL:       session.URL,
		SessionExpiresAt:  session.ExpiresAt,
	}
	handler.mutex.Lock()
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
	sessionInfoFuture.Resolve(sessionInfo, nil)
	output = &StartCheckoutSessionOutput{
		CheckoutSessionID: session.ID,
		CheckoutURL:       session.URL,
	}
	return
}

type RecordCheckoutSessionEventInput struct {
	Payload         []byte
	StripeSignature string
}

func (handler *CommandHandler) RecordCheckoutSessionEvent(ctx context.Context, input RecordCheckoutSessionEventInput) (err error) {
	event, err := handler.stripe.ConstructEvent(input.Payload, input.StripeSignature, handler.webhookSecret)
	if err != nil {
		return
	}
	switch event.Type {
	case stripe.EventTypeCheckoutSessionCompleted:
	case stripe.EventTypeCheckoutSessionExpired:
	case stripe.EventTypeCheckoutSessionAsyncPaymentFailed:
	case stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded:
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
	case events.TypeAccountCreatedV2:
		handler.applyAccountCreatedV2(ctx, event)
	case events.TypeStripeCheckoutSessionStarted:
		handler.applyStripeCheckoutSessionStarted(ctx, event)
	}
}

func (handler *CommandHandler) applyAccountCreatedV2(ctx context.Context, event *eventlog.Event) {
	var detail events.AccountCreatedV2Detail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.trialAccountIDs[detail.AccountID] = struct{}{}
}

func (handler *CommandHandler) applyStripeCheckoutSessionStarted(ctx context.Context, event *eventlog.Event) {
	var detail events.StripeCheckoutSessionStartedDetail
	err := json.Unmarshal(event.Data, &detail)
	fatal.OnError(err)
	handler.sessionInfoForAccount[event.AccountID] = &CheckoutSessionInfo{
		CheckoutSessionID: detail.SessionID,
		CheckoutURL:       detail.CheckoutURL,
		SessionExpiresAt:  detail.SessionExpiresAt,
	}
}
