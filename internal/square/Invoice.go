package square

type InvoiceStatus string

const (
	InvoiceStatusDraft InvoiceStatus = "DRAFT"
	InvoiceStatusPaid  InvoiceStatus = "PAID"
)

type Invoice struct {
	ID             string        `json:"id"`
	SubscriptionID string        `json:"subscription_id"`
	Status         InvoiceStatus `json:"status"`
}
