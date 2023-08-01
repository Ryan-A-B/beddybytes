package square

type EventType string

const (
	// Note: not a complete list of event types
	EventTypeOrderCreated             EventType = "order.created"
	EventTypeOrderUpdated             EventType = "order.updated"
	EventTypeOrderFullfillmentUpdated EventType = "order.fulfillment.updated"
	EventTypePaymentCreated           EventType = "payment.created"
	EventTypePaymentUpdated           EventType = "payment.updated"
)

type Event struct {
	MerchantID string    `json:"merchant_id"`
	Type       EventType `json:"type"`
	EventID    string    `json:"event_id"`
	CreatedAt  string    `json:"created_at"`
	Data       EventData `json:"data"`
}

type EventData struct {
	Type   string `json:"type"`
	ID     string `json:"id"`
	Object Object `json:"object"`
}

type Object struct {
	Payment      *Payment      `json:"payment"`
	Subscription *Subscription `json:"subscription"`
	Invoice      *Invoice      `json:"invoice"`
}
