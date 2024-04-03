package square

type Payment struct {
	// Note: incomplete
	ID                string `json:"id"`
	OrderID           string `json:"order_id"`
	BuyerEmailAddress string `json:"buyer_email_address"`
	CustomerID        string `json:"customer_id"`
	Status            string `json:"status"`
	Version           int    `json:"version"`
}
