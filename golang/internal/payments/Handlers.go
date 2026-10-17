package payments

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/url"

	"github.com/gorilla/mux"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/logx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/paymentrepository"
)

// Commands is the payment repository boundary. Stripe calls, webhook
// verification, fulfillment and event persistence belong to the repository.
type Commands interface {
	StartCheckoutSession(context.Context, paymentrepository.StartCheckoutSessionInput) (*paymentrepository.StartCheckoutSessionOutput, error)
	SyncCheckoutSessionWithResult(context.Context, paymentrepository.SyncCheckoutSessionInput) (*paymentrepository.SyncCheckoutSessionOutput, error)
	RecordCheckoutSessionEvent(context.Context, paymentrepository.RecordCheckoutSessionEventInput) error
}

type Handlers struct {
	Commands    Commands
	Key         interface{}
	FrontendURL string // Fixed payment result page, not a caller-supplied URL.
}

func (handlers *Handlers) AddRoutes(router *mux.Router) {
	start := router.PathPrefix("/payment/start").Subrouter()
	start.Use(internal.NewAuthorizationMiddleware(handlers.Key).Middleware)
	start.HandleFunc("", handlers.Start).Methods(http.MethodPost)

	router.HandleFunc("/payment/stripe/success", handlers.Success).Methods(http.MethodGet)
	router.HandleFunc("/payment/stripe/cancel", handlers.Cancel).Methods(http.MethodGet)
	router.HandleFunc("/payment/stripe/webhook", handlers.Webhook).Methods(http.MethodPost)
}

func (handlers *Handlers) Start(responseWriter http.ResponseWriter, request *http.Request) {
	responseWriter.Header().Set("Cache-Control", "no-store")
	accountID := contextx.GetAccountID(request.Context())
	if accountID == "" {
		http.Error(responseWriter, "unauthorized", http.StatusUnauthorized)
		return
	}
	output, err := handlers.Commands.StartCheckoutSession(request.Context(), paymentrepository.StartCheckoutSessionInput{AccountID: accountID})
	if err != nil {
		if errors.Is(err, paymentrepository.ErrAccountIneligible) {
			http.Error(responseWriter, "account is not eligible for checkout", http.StatusForbidden)
			return
		}
		logx.Warnln(err)
		http.Error(responseWriter, "could not start checkout", http.StatusInternalServerError)
		return
	}
	// Start returns only after the checkout-started event is persisted.
	http.Redirect(responseWriter, request, output.CheckoutURL, http.StatusSeeOther)
}

func (handlers *Handlers) Success(responseWriter http.ResponseWriter, request *http.Request) {
	responseWriter.Header().Set("Cache-Control", "no-store")
	sessionID := request.URL.Query().Get("session_id")
	if sessionID == "" {
		handlers.redirect(responseWriter, request, "invalid_request")
		return
	}
	output, err := handlers.Commands.SyncCheckoutSessionWithResult(request.Context(), paymentrepository.SyncCheckoutSessionInput{CheckoutSessionID: sessionID})
	if err != nil {
		logx.Warnln(err)
		handlers.redirect(responseWriter, request, "temporarily_unavailable")
		return
	}
	if output.Paid {
		handlers.redirect(responseWriter, request, "")
	} else if output.Processing {
		handlers.redirect(responseWriter, request, "payment_pending")
	} else {
		handlers.redirect(responseWriter, request, "payment_failed")
	}
}

func (handlers *Handlers) Cancel(responseWriter http.ResponseWriter, request *http.Request) {
	// Leaving Checkout is browser navigation, not a failed or expired payment.
	// There is no repository cancellation command; leave the session reusable.
	handlers.redirect(responseWriter, request, "payment_cancelled")
}

func (handlers *Handlers) Webhook(responseWriter http.ResponseWriter, request *http.Request) {
	payload, err := io.ReadAll(http.MaxBytesReader(responseWriter, request.Body, 1024*1024))
	if err != nil {
		status := http.StatusBadRequest
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			status = http.StatusRequestEntityTooLarge
		}
		http.Error(responseWriter, "invalid webhook body", status)
		return
	}
	signature := request.Header.Get("Stripe-Signature")
	if signature == "" {
		http.Error(responseWriter, "Stripe signature is required", http.StatusBadRequest)
		return
	}
	if err := handlers.Commands.RecordCheckoutSessionEvent(request.Context(), paymentrepository.RecordCheckoutSessionEventInput{Payload: payload, Signature: signature}); err != nil {
		logx.Warnln(err)
		// Repository errors include failed event persistence. Keep them retryable;
		// never acknowledge a webhook that the command failed to process.
		http.Error(responseWriter, "could not process checkout event", http.StatusInternalServerError)
		return
	}
	responseWriter.WriteHeader(http.StatusOK)
}

func (handlers *Handlers) redirect(responseWriter http.ResponseWriter, request *http.Request, errorCode string) {
	responseWriter.Header().Set("Cache-Control", "no-store")
	frontendURL, err := url.Parse(handlers.FrontendURL)
	if err != nil || (frontendURL.Scheme != "https" && frontendURL.Scheme != "http") || frontendURL.Host == "" {
		http.Error(responseWriter, "invalid frontend configuration", http.StatusInternalServerError)
		return
	}
	query := frontendURL.Query()
	query.Del("payment_status")
	query.Del("error")
	if errorCode != "" {
		query.Set("error", errorCode)
	}
	frontendURL.RawQuery = query.Encode()
	http.Redirect(responseWriter, request, frontendURL.String(), http.StatusSeeOther)
}
