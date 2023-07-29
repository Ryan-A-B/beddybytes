package squarehandlers

import (
	"github.com/Ryan-A-B/baby-monitor/backend/accounts"
	"github.com/Ryan-A-B/baby-monitor/internal/square"
	"github.com/ansel1/merry"
	uuid "github.com/satori/go.uuid"
)

type SquarePayments struct {
	client                 *square.Client
	subscriptionPlanID     string
	locationID             string
	accountIDByOrderID     map[string]string
	paymentLinkByAccountID map[string]*square.PaymentLink
}

type NewSquarePaymentsInput struct {
	Client             *square.Client
	SubscriptionPlanID string
	LocationID         string
}

func NewSquarePayments(input *NewSquarePaymentsInput) *SquarePayments {
	return &SquarePayments{
		client:                 input.Client,
		subscriptionPlanID:     input.SubscriptionPlanID,
		locationID:             input.LocationID,
		paymentLinkByAccountID: make(map[string]*square.PaymentLink),
		accountIDByOrderID:     make(map[string]string),
	}
}

func (payments *SquarePayments) GetPaymentLinkURL(accountID string, subscriptionState accounts.SubscriptionState) (paymentLinkURL string, err error) {
	if paymentLink, ok := payments.paymentLinkByAccountID[accountID]; ok {
		paymentLinkURL = paymentLink.URL
		return
	}
	input := square.CreatePaymentLinkInput{
		IdempotencyKey: uuid.NewV4().String(),
		CheckoutOptions: &square.CheckoutOptions{
			SubscriptionPlanID: payments.subscriptionPlanID,
		},
		QuickPay: &square.QuickPay{
			LocationID: payments.locationID,
			Name:       "Baby Monitor",
			Price: square.Money{
				Amount:   500,
				Currency: square.AUD,
			},
		},
	}
	output, err := payments.client.CreatePaymentLink(&input)
	if err != nil {
		err = merry.WithHTTPCode(err, 500)
		return
	}
	paymentLink := output.PaymentLink
	paymentLinkURL = paymentLink.URL
	payments.paymentLinkByAccountID[accountID] = paymentLink
	payments.accountIDByOrderID[paymentLink.OrderID] = accountID
	return
}
