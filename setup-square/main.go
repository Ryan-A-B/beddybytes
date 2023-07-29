package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	uuid "github.com/satori/go.uuid"

	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
	"github.com/Ryan-A-B/baby-monitor/internal/square"
)

func main() {
	client := square.NewClient(&square.NewClientInput{
		HTTPClient:    http.DefaultClient,
		Scheme:        os.Getenv("SQUARE_SCHEME"),
		Host:          os.Getenv("SQUARE_HOST"),
		Version:       os.Getenv("SQUARE_VERSION"),
		ApplicationID: os.Getenv("SQUARE_APPLICATION_ID"),
		AccessToken:   os.Getenv("SQUARE_ACCESS_TOKEN"),
	})
	// subscriptionPlan, err := CreateSubscriptionPlan(client)
	// fatal.OnError(err)
	// subscriptionPlanID := subscriptionPlan["catalog_object"].(map[string]interface{})["id"].(string)
	// log.Println("subscription plan created: " + subscriptionPlanID)
	// PrintJSON(subscriptionPlan)
	subscriptionPlanID := os.Getenv("SQUARE_SUBSCRIPTION_PLAN_ID")
	subscriptionPlanVariation, err := CreateSubscriptionPlanVariation(client, subscriptionPlanID)
	fatal.OnError(err)
	subscriptionPlanVariationID := subscriptionPlanVariation["catalog_object"].(map[string]interface{})["id"].(string)
	log.Println("subscription plan variation created: " + subscriptionPlanVariationID)
	PrintJSON(subscriptionPlanVariation)
}

func CreateSubscriptionPlan(client *square.Client) (output square.UpsertCatalogObjectOutput, err error) {
	idempotencyKey := uuid.NewV4().String()
	objectID := "#plan"
	input := square.UpsertCatalogObjectInput{
		IdempotencyKey: idempotencyKey,
		Object: square.CatalogObject{
			Type: square.CatalogObjectTypeSubscriptionPlan,
			ID:   objectID,
			SubscriptionPlan: &square.SubscriptionPlan{
				Name: "Baby Monitor Subscription",
			},
		},
	}
	output, err = client.UpsertCatalogObject(&input)
	fatal.OnError(err)
	return
}

func CreateSubscriptionPlanVariation(client *square.Client, subscriptionPlanID string) (output square.UpsertCatalogObjectOutput, err error) {
	idempotencyKey := uuid.NewV4().String()
	objectID := "#plan_variation"
	input := square.UpsertCatalogObjectInput{
		IdempotencyKey: idempotencyKey,
		Object: square.CatalogObject{
			Type: square.CatalogObjectTypeSubscriptionPlanVariation,
			ID:   objectID,
			SubscriptionPlanVariation: &square.SubscriptionPlanVariation{
				Name:               "Monthly",
				SubscriptionPlanID: subscriptionPlanID,
				Phases: []square.SubscriptionPhase{
					{
						Cadence: square.Monthly,
						Pricing: square.SubscriptionPricing{
							Type: square.SubscriptionPricingTypeStatic,
							Price: square.Money{
								Amount:   500,
								Currency: square.AUD,
							},
						},
					},
				},
			},
		},
	}
	output, err = client.UpsertCatalogObject(&input)
	fatal.OnError(err)
	return
}

func PrintJSON(v interface{}) {
	json, err := json.MarshalIndent(v, "", "  ")
	fatal.OnError(err)
	fmt.Println(string(json))
}
