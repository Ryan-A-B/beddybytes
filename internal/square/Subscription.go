package square

import "net/url"

type Subscription struct {
	ID                       string `json:"id"`
	OrderTemplateID          string `json:"order_template_id"`
	BuyerSelfManagementToken string `json:"buyer_self_management_token"`
}

func (subscription *Subscription) GetSelfManagementURL() string {
	query := make(url.Values)
	query.Set("buyer_management_token", subscription.BuyerSelfManagementToken)
	target := url.URL{
		Scheme:   "https",
		Host:     "squareup.com",
		Path:     "/buyer-subscriptions/manage",
		RawQuery: query.Encode(),
	}
	return target.String()
}
