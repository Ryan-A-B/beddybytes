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
	SyncCheckoutSession(context.Context, paymentrepository.SyncCheckoutSessionInput) error
	RecordCheckoutSessionEvent(context.Context, paymentrepository.RecordCheckoutSessionEventInput) error
}

type Handlers struct {
	Commands    Commands
	Key         interface{}
	FrontendURL string // Fixed payment result page, not a caller-supplied URL.
}

func (h *Handlers) AddRoutes(router *mux.Router) {
	start := router.PathPrefix("/payment/start").Subrouter()
	start.Use(internal.NewAuthorizationMiddleware(h.Key).Middleware)
	start.HandleFunc("", h.Start).Methods(http.MethodPost)

	router.HandleFunc("/payment/stripe/success", h.Success).Methods(http.MethodGet)
	router.HandleFunc("/payment/stripe/cancel", h.Cancel).Methods(http.MethodGet)
	router.HandleFunc("/payment/stripe/webhook", h.Webhook).Methods(http.MethodPost)
}

func (h *Handlers) Start(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	accountID := contextx.GetAccountID(r.Context())
	if accountID == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	output, err := h.Commands.StartCheckoutSession(r.Context(), paymentrepository.StartCheckoutSessionInput{AccountID: accountID})
	if err != nil {
		if errors.Is(err, paymentrepository.ErrAccountIneligible) {
			http.Error(w, "account is not eligible for checkout", http.StatusForbidden)
			return
		}
		logx.Warnln(err)
		http.Error(w, "could not start checkout", http.StatusInternalServerError)
		return
	}
	if output == nil || output.CheckoutURL == "" {
		http.Error(w, "could not start checkout", http.StatusInternalServerError)
		return
	}
	// Start returns only after the checkout-started event is persisted.
	http.Redirect(w, r, output.CheckoutURL, http.StatusSeeOther)
}

func (h *Handlers) Success(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	sessionID := r.URL.Query().Get("session_id")
	if sessionID == "" {
		http.Error(w, "session ID is required", http.StatusBadRequest)
		return
	}
	if err := h.Commands.SyncCheckoutSession(r.Context(), paymentrepository.SyncCheckoutSessionInput{CheckoutSessionID: sessionID}); err != nil {
		logx.Warnln(err)
		http.Error(w, "could not sync checkout", http.StatusInternalServerError)
		return
	}
	// Sync does not return payment status. The frontend must read the account
	// license rather than treating a browser return as proof of payment.
	h.redirect(w, r, "pending")
}

func (h *Handlers) Cancel(w http.ResponseWriter, r *http.Request) {
	// Leaving Checkout is browser navigation, not a failed or expired payment.
	// There is no repository cancellation command; leave the session reusable.
	h.redirect(w, r, "cancelled")
}

func (h *Handlers) Webhook(w http.ResponseWriter, r *http.Request) {
	payload, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 1024*1024))
	if err != nil {
		status := http.StatusBadRequest
		var tooLarge *http.MaxBytesError
		if errors.As(err, &tooLarge) {
			status = http.StatusRequestEntityTooLarge
		}
		http.Error(w, "invalid webhook body", status)
		return
	}
	signature := r.Header.Get("Stripe-Signature")
	if signature == "" {
		http.Error(w, "Stripe signature is required", http.StatusBadRequest)
		return
	}
	if err := h.Commands.RecordCheckoutSessionEvent(r.Context(), paymentrepository.RecordCheckoutSessionEventInput{Payload: payload, Signature: signature}); err != nil {
		logx.Warnln(err)
		// Repository errors include failed event persistence. Keep them retryable;
		// never acknowledge a webhook that the command failed to process.
		http.Error(w, "could not process checkout event", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *Handlers) redirect(w http.ResponseWriter, r *http.Request, status string) {
	w.Header().Set("Cache-Control", "no-store")
	u, err := url.Parse(h.FrontendURL)
	if err != nil || (u.Scheme != "https" && u.Scheme != "http") || u.Host == "" {
		http.Error(w, "invalid frontend configuration", http.StatusInternalServerError)
		return
	}
	query := u.Query()
	query.Set("payment_status", status)
	u.RawQuery = query.Encode()
	http.Redirect(w, r, u.String(), http.StatusSeeOther)
}
