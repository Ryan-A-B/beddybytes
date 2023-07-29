package square

import (
	"bytes"
	"encoding/json"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"

	"github.com/ansel1/merry"

	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
)

type Client struct {
	httpClient    *http.Client
	scheme        string
	host          string
	version       string
	applicationID string
	authorization string
}

type NewClientInput struct {
	HTTPClient    *http.Client
	Scheme        string
	Host          string
	Version       string
	ApplicationID string
	AccessToken   string
}

func NewClient(input *NewClientInput) *Client {
	return &Client{
		httpClient:    input.HTTPClient,
		scheme:        input.Scheme,
		host:          input.Host,
		version:       input.Version,
		applicationID: input.ApplicationID,
		authorization: "Bearer " + input.AccessToken,
	}
}

type CreatePaymentLinkInput struct {
	IdempotencyKey  string           `json:"idempotency_key"`
	CheckoutOptions *CheckoutOptions `json:"checkout_options"`
	QuickPay        *QuickPay        `json:"quick_pay"`
}

type CheckoutOptions struct {
	SubscriptionPlanID string `json:"subscription_plan_id"`
}

type QuickPay struct {
	LocationID string `json:"location_id"`
	Name       string `json:"name"`
	Price      Money  `json:"price_money"`
}

type CreatePaymentLinkOutput struct {
	PaymentLink *PaymentLink `json:"payment_link"`
}

type PaymentLink struct {
	ID              string           `json:"id"`
	CheckoutOptions *CheckoutOptions `json:"checkout_options"`
	CreatedAt       string           `json:"created_at"`
	LongURL         string           `json:"long_url"`
	OrderID         string           `json:"order_id"`
	URL             string           `json:"url"`
}

type Currency string

const AUD Currency = "AUD"

type Money struct {
	Amount   int64    `json:"amount"`
	Currency Currency `json:"currency"`
}

func (client *Client) CreatePaymentLink(input *CreatePaymentLinkInput) (output *CreatePaymentLinkOutput, err error) {
	target := url.URL{
		Scheme: client.scheme,
		Host:   client.host,
		Path:   "/v2/online-checkout/payment-links",
	}
	payload, err := json.Marshal(input)
	fatal.OnError(err)
	request, err := http.NewRequest(http.MethodPost, target.String(), bytes.NewReader(payload))
	fatal.OnError(err)
	request.Header.Add("Square-Version", client.version)
	request.Header.Add("Authorization", client.authorization)
	request.Header.Add("Content-Type", "application/json")
	response, err := client.httpClient.Do(request)
	fatal.OnError(err)
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		log.Println("Warn: Square API returned status code " + response.Status)
		var data []byte
		data, err = ioutil.ReadAll(response.Body)
		fatal.OnError(err)
		log.Println("Warn: Square API returned body " + string(data))
		err = merry.New(string(data)).WithHTTPCode(response.StatusCode)
		return
	}
	output = new(CreatePaymentLinkOutput)
	err = json.NewDecoder(response.Body).Decode(&output)
	if err != nil {
		return
	}
	return
}

type UpsertCatalogObjectInput struct {
	IdempotencyKey string        `json:"idempotency_key"`
	Object         CatalogObject `json:"object"`
}

type UpsertCatalogObjectOutput map[string]interface{}

type IDMapping struct {
	ClientObjectID string `json:"client_object_id"`
	ObjectID       string `json:"object_id"`
}

type CatalogObjectType string

const (
	CatalogObjectTypeSubscriptionPlan          CatalogObjectType = "SUBSCRIPTION_PLAN"
	CatalogObjectTypeSubscriptionPlanVariation CatalogObjectType = "SUBSCRIPTION_PLAN_VARIATION"
)

type CatalogObject struct {
	Type                      CatalogObjectType          `json:"type"`
	ID                        string                     `json:"id"`
	UpdatedAt                 string                     `json:"updated_at"`
	CreatedAt                 string                     `json:"created_at"`
	Version                   int32                      `json:"version"`
	IsDeleted                 bool                       `json:"is_deleted"`
	PresentAtAllLocations     bool                       `json:"present_at_all_locations"`
	SubscriptionPlan          *SubscriptionPlan          `json:"subscription_plan_data"`
	SubscriptionPlanVariation *SubscriptionPlanVariation `json:"subscription_plan_variation_data"`
}

type SubscriptionPlan struct {
	Name string `json:"name"`
}

type SubscriptionPlanVariation struct {
	Name               string              `json:"name"`
	SubscriptionPlanID string              `json:"subscription_plan_id"`
	Phases             []SubscriptionPhase `json:"phases"`
}

type Cadence string

const Weekly Cadence = "WEEKLY"
const Monthly Cadence = "MONTHLY"

type SubscriptionPhase struct {
	Cadence Cadence             `json:"cadence"`
	Pricing SubscriptionPricing `json:"pricing"`
}

type SubscriptionPricingType string

const (
	SubscriptionPricingTypeStatic   SubscriptionPricingType = "STATIC"
	SubscriptionPricingTypeRelative SubscriptionPricingType = "RELATIVE"
)

type SubscriptionPricing struct {
	Type  SubscriptionPricingType `json:"type"`
	Price Money                   `json:"price_money"`
}

func (client *Client) UpsertCatalogObject(input *UpsertCatalogObjectInput) (output UpsertCatalogObjectOutput, err error) {
	target := url.URL{
		Scheme: client.scheme,
		Host:   client.host,
		Path:   "/v2/catalog/object",
	}
	payload, err := json.Marshal(input)
	fatal.OnError(err)
	request, err := http.NewRequest(http.MethodPost, target.String(), bytes.NewReader(payload))
	if err != nil {
		return
	}
	request.Header.Add("Square-Version", client.version)
	request.Header.Add("Authorization", client.authorization)
	request.Header.Add("Content-Type", "application/json")
	response, err := client.httpClient.Do(request)
	fatal.OnError(err)
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		var data []byte
		data, err = ioutil.ReadAll(response.Body)
		fatal.OnError(err)
		err = merry.New(string(data)).WithHTTPCode(response.StatusCode)
		return
	}
	output = make(UpsertCatalogObjectOutput)
	err = json.NewDecoder(response.Body).Decode(&output)
	if err != nil {
		return
	}
	return
}
