package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/dgrijalva/jwt-go"

	"github.com/Ryan-A-B/beddybytes/golang/internal/osx"
)

var ErrMissingAuthorizationHeader = errors.New("missing authorization header")
var ErrUnauthorized = errors.New("unauthorized")

var accountID string
var region string
var encryptionKey []byte

func main() {
	ctx := context.Background()
	accountID = osx.GetEnvStringOrFatal("AWS_ACCOUNT_ID")
	region = osx.GetEnvStringOrFatal("AWS_REGION")
	encryptionKey = loadEncryptionKey(ctx)

	lambda.Start(handler)
}

func handler(request events.IoTCoreCustomAuthorizerRequest) (response events.IoTCoreCustomAuthorizerResponse, err error) {
	prefix := "Bearer "
	authorization := request.ProtocolData.HTTP.Headers["Authorization"]
	if !strings.HasPrefix(authorization, prefix) {
		return
	}
	accessToken := strings.TrimPrefix(authorization, prefix)
	var claims Claims
	_, err = jwt.ParseWithClaims(accessToken, &claims, getEncryptionKey)
	if err != nil {
		log.Println("failed to parse access token:", err)
		return
	}
	if claims.Subject.Service != "iam" {
		log.Println("wrong subject service:", claims.Subject.Service)
		return
	}
	if claims.Subject.ResourceType != "user" {
		log.Println("wrong subject resource type:", claims.Subject.ResourceType)
		return
	}
	response.PrincipalID = createPrincipalID()
	response.PolicyDocuments = []*events.IAMPolicyDocument{
		{
			Version: "2012-10-17",
			Statement: []events.IAMPolicyStatement{
				{
					Effect: "Allow",
					Action: []string{
						"iot:Connect",
					},
					Resource: []string{
						fmt.Sprintf("arn:aws:iot:%s:%s:topic/telemetry/${iot:ClientId}", region, accountID),
					},
				},
				{
					Effect: "Allow",
					Action: []string{
						"iot:Publish",
						"iot:Receive",
					},
					Resource: []string{
						fmt.Sprintf("arn:aws:iot:%s:%s:topic/accounts/%s/connections/+/status", region, accountID, claims.Subject.AccountID),
						fmt.Sprintf("arn:aws:iot:%s:%s:topic/accounts/%s/connections/+/inbox", region, accountID, claims.Subject.AccountID),
					},
				},
				{
					Effect: "Allow",
					Action: []string{
						"iot:Subscribe",
					},
					Resource: []string{
						fmt.Sprintf("arn:aws:iot:%s:%s:topicfilter/accounts/%s/connections/+/status", region, accountID, claims.Subject.AccountID),
						fmt.Sprintf("arn:aws:iot:%s:%s:topicfilter/accounts/%s/connections/+/inbox", region, accountID, claims.Subject.AccountID),
					},
				},
			},
		},
	}
	response.IsAuthenticated = true
	response.DisconnectAfterInSeconds = 12 * 60 * 60
	response.RefreshAfterInSeconds = 30 * 60
	return
}

func getEncryptionKey(token *jwt.Token) (interface{}, error) {
	return encryptionKey, nil
}

func createPrincipalID() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	length := rand.Intn(127) + 1
	var result strings.Builder
	for i := 0; i < length; i++ {
		result.WriteByte(charset[rand.Intn(len(charset))])
	}
	return result.String()
}

func loadEncryptionKey(ctx context.Context) []byte {
	secretID := osx.GetEnvStringOrFatal("ENCRYPTION_KEY_ARN")
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		panic("failed to load AWS config: " + err.Error())
	}
	client := secretsmanager.NewFromConfig(cfg)
	output, err := client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
		SecretId: &secretID,
	})
	if err != nil {
		panic("failed to retrieve secret: " + err.Error())
	}
	return []byte(*output.SecretString)
}
