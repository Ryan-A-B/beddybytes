// Package payments sketches the HTTP/Stripe boundary. Repository integration
// is deliberately an interface while the payment event model is being designed.
package payments

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/mux"
	"github.com/stripe/stripe-go/v87"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
)

// Payment is the information available when recording a Stripe checkout.
// Keep these contracts independent of Stripe types in the eventual repository.
type Payment struct {
	PaymentID             string
	AccountID             string
	StripeCheckoutID      string
	StripePaymentIntentID string
	PriceID               string
	AmountTotal           int64
	Currency              string
}

// Commands sketches the repository operations needed by the HTTP flow.
// StartPayment validates the account and returns a durable attempt ID.
// RecordCheckout associates that attempt with the newly created Stripe session.
// Success must be idempotent and may follow cancellation (browser abandonment).
type Commands interface {
	StartPayment(context.Context, string) (string, error)
	RecordCheckout(context.Context, Payment) error
	RecordPaymentSuccess(context.Context, Payment) error
	RecordPaymentCancelled(context.Context, Payment) error
}

type Handlers struct {
	Stripe        *stripe.Client
	Commands      Commands
	Key           interface{}
	PriceID       string
	WebhookSecret string
	APIBaseURL    string // Fixed configuration, e.g. https://api.beddybytes.com
	FrontendURL   string // Fixed payment result page, not a caller-supplied URL
	LiveMode      bool
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
	// The existing middleware reads access_token from the browser form POST.
	accountID := contextx.GetAccountID(r.Context())
	paymentID, err := h.Commands.StartPayment(r.Context(), accountID)
	if err != nil || paymentID == "" {
		http.Error(w, "could not start payment", http.StatusInternalServerError)
		return
	}
	base := strings.TrimRight(h.APIBaseURL, "/")
	params := &stripe.CheckoutSessionCreateParams{
		Mode:              stripe.String("payment"),
		ClientReferenceID: stripe.String(accountID),
		LineItems: []*stripe.CheckoutSessionCreateLineItemParams{
			{Price: stripe.String(h.PriceID), Quantity: stripe.Int64(1)},
		},
		Metadata:   map[string]string{"payment_id": paymentID, "account_id": accountID},
		SuccessURL: stripe.String(base + "/payment/stripe/success?session_id={CHECKOUT_SESSION_ID}"),
		CancelURL:  stripe.String(base + "/payment/stripe/cancel?payment_id=" + url.QueryEscape(paymentID)),
	}
	params.SetIdempotencyKey("beddybytes-checkout-" + paymentID)
	session, err := h.Stripe.V1CheckoutSessions.Create(r.Context(), params)
	if err != nil {
		// TODO: model a failed checkout-creation attempt and retries.
		http.Error(w, "could not create Stripe checkout", http.StatusBadGateway)
		return
	}
	if err := h.Commands.RecordCheckout(r.Context(), h.payment(session)); err != nil {
		// TODO: reconcile the Stripe session if event persistence fails.
		http.Error(w, "could not record checkout", http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, session.URL, http.StatusSeeOther)
}

func (h *Handlers) Success(w http.ResponseWriter, r *http.Request) {
	paid, err := h.fulfill(r.Context(), r.URL.Query().Get("session_id"))
	if err != nil {
		http.Error(w, "could not verify payment", http.StatusBadGateway)
		return
	}
	status := "pending"
	if paid {
		status = "succeeded"
	}
	h.redirect(w, r, status)
}

func (h *Handlers) Cancel(w http.ResponseWriter, r *http.Request) {
	paymentID := r.URL.Query().Get("payment_id")
	if paymentID == "" {
		http.Error(w, "payment ID is required", http.StatusBadRequest)
		return
	}
	// The repository resolves account/session details from the recorded attempt.
	// This records browser abandonment; it does not expire the Stripe session.
	// A later verified success must still win, and cancellation after success
	// must be a no-op. This URL uses an unguessable attempt ID, not an account ID.
	if err := h.Commands.RecordPaymentCancelled(r.Context(), Payment{PaymentID: paymentID}); err != nil {
		http.Error(w, "could not record cancellation", http.StatusInternalServerError)
		return
	}
	h.redirect(w, r, "cancelled")
}

func (h *Handlers) Webhook(w http.ResponseWriter, r *http.Request) {
	payload, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64*1024))
	if err != nil {
		http.Error(w, "invalid webhook body", http.StatusBadRequest)
		return
	}
	event, err := h.Stripe.ConstructEvent(payload, r.Header.Get("Stripe-Signature"), h.WebhookSecret)
	if err != nil {
		http.Error(w, "invalid Stripe signature or event", http.StatusBadRequest)
		return
	}
	switch event.Type {
	case "checkout.session.completed", "checkout.session.async_payment_succeeded":
		var session stripe.CheckoutSession
		if err := json.Unmarshal(event.Data.Raw, &session); err != nil {
			http.Error(w, "invalid checkout event", http.StatusBadRequest)
			return
		}
		if _, err := h.fulfill(r.Context(), session.ID); err != nil {
			// Non-2xx makes Stripe retry. Acknowledge only after recording success.
			http.Error(w, "could not record payment", http.StatusInternalServerError)
			return
		}
		// TODO: model async_payment_failed/session.expired separately from
		// browser cancellation if those states are useful to the repository.
	}
	w.WriteHeader(http.StatusOK)
}

func (h *Handlers) fulfill(ctx context.Context, sessionID string) (bool, error) {
	session, err := h.checkout(ctx, sessionID)
	if err != nil {
		return false, err
	}
	if session.PaymentStatus != stripe.CheckoutSessionPaymentStatusPaid {
		return false, nil
	}
	err = h.Commands.RecordPaymentSuccess(ctx, h.payment(session))
	return err == nil, err
}

func (h *Handlers) checkout(ctx context.Context, sessionID string) (*stripe.CheckoutSession, error) {
	if sessionID == "" {
		return nil, errors.New("session ID is required")
	}
	params := &stripe.CheckoutSessionRetrieveParams{}
	params.AddExpand("line_items")
	session, err := h.Stripe.V1CheckoutSessions.Retrieve(ctx, sessionID, params)
	if err != nil {
		return nil, err
	}
	if session.Mode != stripe.CheckoutSessionModePayment || session.Livemode != h.LiveMode ||
		session.Metadata["payment_id"] == "" || session.ClientReferenceID == "" ||
		session.Metadata["account_id"] != session.ClientReferenceID {
		return nil, errors.New("checkout does not match this payment flow")
	}
	if session.LineItems == nil || session.LineItems.HasMore || len(session.LineItems.Data) != 1 {
		return nil, errors.New("unexpected checkout items")
	}
	item := session.LineItems.Data[0]
	if item.Price == nil || item.Price.ID != h.PriceID || item.Quantity != 1 {
		return nil, errors.New("unexpected checkout price or quantity")
	}
	// The repository must also check these IDs against the recorded attempt.
	return session, nil
}

func (h *Handlers) payment(session *stripe.CheckoutSession) Payment {
	payment := Payment{
		PaymentID: session.Metadata["payment_id"], AccountID: session.ClientReferenceID,
		StripeCheckoutID: session.ID, PriceID: h.PriceID,
		AmountTotal: session.AmountTotal, Currency: string(session.Currency),
	}
	if session.PaymentIntent != nil {
		payment.StripePaymentIntentID = session.PaymentIntent.ID
	}
	return payment
}

func (h *Handlers) redirect(w http.ResponseWriter, r *http.Request, status string) {
	u, err := url.Parse(h.FrontendURL)
	if err != nil {
		http.Error(w, "invalid frontend configuration", http.StatusInternalServerError)
		return
	}
	query := u.Query()
	query.Set("payment_status", status)
	u.RawQuery = query.Encode()
	http.Redirect(w, r, u.String(), http.StatusSeeOther)
}
