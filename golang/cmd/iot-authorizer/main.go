package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/url"
	"strings"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/secretsmanager"
	"github.com/dgrijalva/jwt-go"
)

const (
	disconnectAfterSeconds = 12 * 60 * 60
	refreshAfterSeconds    = 30 * 60
)

var (
	errMissingAccessToken = errors.New("missing access token")
	errMissingClientID    = errors.New("missing MQTT client ID")
	errUnauthorized       = errors.New("unauthorized")

	awsAccountID string
	awsRegion    string
	signingKey   []byte
)

func main() {
	ctx := context.Background()
	awsAccountID = internal.EnvStringOrFatal("AWS_ACCOUNT_ID")
	awsRegion = internal.EnvStringOrFatal("AWS_REGION")
	signingKey = loadSigningKey(ctx)

	lambda.Start(handler)
}

func handler(request events.IoTCoreCustomAuthorizerRequest) (CustomAuthorizerResponse, error) {
	response, err := authorize(request, AuthorizerConfig{
		awsAccountID: awsAccountID,
		awsRegion:    awsRegion,
		signingKey:   signingKey,
	})
	if err != nil {
		log.Printf("MQTT authorizer denied access: reason=%q mqttClientID=%q", err.Error(), mqttClientIDFromRequest(request))
		return CustomAuthorizerResponse{IsAuthenticated: false}, nil
	}
	logAuthorizationGranted(response, mqttClientIDFromRequest(request))
	return response, nil
}

func logAuthorizationGranted(response CustomAuthorizerResponse, mqttClientID string) {
	policyJSON, err := json.Marshal(response.PolicyDocuments)
	if err != nil {
		log.Printf("MQTT authorizer granted access: principalID=%q mqttClientID=%q policyMarshalError=%q", response.PrincipalID, mqttClientID, err.Error())
		return
	}
	log.Printf("MQTT authorizer granted access: principalID=%q mqttClientID=%q policyDocuments=%s", response.PrincipalID, mqttClientID, string(policyJSON))
}

type AuthorizerConfig struct {
	awsAccountID string
	awsRegion    string
	signingKey   []byte
}

type CustomAuthorizerResponse struct {
	IsAuthenticated          bool                        `json:"isAuthenticated"`
	PrincipalID              string                      `json:"principalId,omitempty"`
	DisconnectAfterInSeconds uint32                      `json:"disconnectAfterInSeconds,omitempty"`
	RefreshAfterInSeconds    uint32                      `json:"refreshAfterInSeconds,omitempty"`
	PolicyDocuments          []*events.IAMPolicyDocument `json:"policyDocuments,omitempty"`
}

func authorize(request events.IoTCoreCustomAuthorizerRequest, config AuthorizerConfig) (CustomAuthorizerResponse, error) {
	accessToken, err := extractAccessToken(request)
	if err != nil {
		return CustomAuthorizerResponse{}, err
	}
	mqttClientID := mqttClientIDFromRequest(request)
	if mqttClientID == "" {
		return CustomAuthorizerResponse{}, errMissingClientID
	}
	claims, err := parseClaims(accessToken, config.signingKey)
	if err != nil {
		return CustomAuthorizerResponse{}, fmt.Errorf("invalid access token: %w", err)
	}
	if claims.Subject.Service != "iam" {
		return CustomAuthorizerResponse{}, fmt.Errorf("unexpected subject service %q: %w", claims.Subject.Service, errUnauthorized)
	}
	if claims.Subject.ResourceType != "user" {
		return CustomAuthorizerResponse{}, fmt.Errorf("unexpected subject resource type %q: %w", claims.Subject.ResourceType, errUnauthorized)
	}
	beddybytesAccountID := claims.Subject.AccountID
	if beddybytesAccountID == "" {
		return CustomAuthorizerResponse{}, fmt.Errorf("missing BeddyBytes account ID: %w", errUnauthorized)
	}
	return CustomAuthorizerResponse{
		IsAuthenticated:          true,
		PrincipalID:              principalIDForClaims(claims),
		PolicyDocuments:          []*events.IAMPolicyDocument{newPolicyDocument(config.awsRegion, config.awsAccountID, beddybytesAccountID, mqttClientID)},
		DisconnectAfterInSeconds: disconnectAfterSeconds,
		RefreshAfterInSeconds:    refreshAfterSeconds,
	}, nil
}

func extractAccessToken(request events.IoTCoreCustomAuthorizerRequest) (string, error) {
	if request.Token != "" {
		return request.Token, nil
	}
	if request.ProtocolData != nil && request.ProtocolData.HTTP != nil {
		if accessToken := accessTokenFromQueryString(request.ProtocolData.HTTP.QueryString); accessToken != "" {
			return accessToken, nil
		}
		if accessToken := accessTokenFromAuthorizationHeader(request.ProtocolData.HTTP.Headers); accessToken != "" {
			return accessToken, nil
		}
	}
	return "", errMissingAccessToken
}

func mqttClientIDFromRequest(request events.IoTCoreCustomAuthorizerRequest) string {
	if request.ProtocolData == nil || request.ProtocolData.MQTT == nil {
		return ""
	}
	return request.ProtocolData.MQTT.ClientID
}

func accessTokenFromQueryString(queryString string) string {
	if queryString == "" {
		return ""
	}
	values, err := url.ParseQuery(strings.TrimPrefix(queryString, "?"))
	if err != nil {
		return ""
	}
	return values.Get("access_token")
}

func accessTokenFromAuthorizationHeader(headers map[string]string) string {
	const prefix = "Bearer "
	for key, value := range headers {
		if !strings.EqualFold(key, "Authorization") {
			continue
		}
		if !strings.HasPrefix(value, prefix) {
			return ""
		}
		return strings.TrimPrefix(value, prefix)
	}
	return ""
}

func parseClaims(accessToken string, signingKey []byte) (*internal.Claims, error) {
	var claims internal.Claims
	token, err := jwt.ParseWithClaims(accessToken, &claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errUnauthorized
		}
		return signingKey, nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errUnauthorized
	}
	return &claims, nil
}

func principalIDForClaims(claims *internal.Claims) string {
	sum := sha256.Sum256([]byte(claims.Subject.String()))
	return "user" + hex.EncodeToString(sum[:])[:32]
}

func newPolicyDocument(awsRegion string, awsAccountID string, beddybytesAccountID string, mqttClientID string) *events.IAMPolicyDocument {
	client := func(clientID string) string {
		return fmt.Sprintf("arn:aws:iot:%s:%s:client/%s", awsRegion, awsAccountID, clientID)
	}
	topicFilter := func(topicFilterName string) string {
		return fmt.Sprintf("arn:aws:iot:%s:%s:topicfilter/%s", awsRegion, awsAccountID, topicFilterName)
	}
	topic := func(topicName string) string {
		return fmt.Sprintf("arn:aws:iot:%s:%s:topic/%s", awsRegion, awsAccountID, topicName)
	}
	accountTopic := func(topicName string) string {
		return fmt.Sprintf("accounts/%s/%s", beddybytesAccountID, topicName)
	}
	return &events.IAMPolicyDocument{
		Version: "2012-10-17",
		Statement: []events.IAMPolicyStatement{
			{
				Effect:   "Allow",
				Action:   []string{"iot:Connect"},
				Resource: []string{client(mqttClientID)},
			},
			{
				Effect: "Allow",
				Action: []string{"iot:Subscribe"},
				Resource: []string{
					topicFilter(accountTopic(fmt.Sprintf("clients/%s/webrtc_inbox", mqttClientID))),
					topicFilter(accountTopic(fmt.Sprintf("clients/%s/control_inbox", mqttClientID))),
					topicFilter(accountTopic("clients/+/status")),
					topicFilter(accountTopic("baby_stations")),
					topicFilter(accountTopic("parent_stations")),
				},
			},
			{
				Effect: "Allow",
				Action: []string{"iot:Publish"},
				Resource: []string{
					topic(accountTopic(fmt.Sprintf("clients/%s/status", mqttClientID))),
					topic(accountTopic("clients/*/webrtc_inbox")),
					topic(accountTopic("clients/*/control_inbox")),
					topic(accountTopic("baby_stations")),
					topic(accountTopic("parent_stations")),
				},
			},
			{
				Effect: "Allow",
				Action: []string{"iot:Receive"},
				Resource: []string{
					topic(accountTopic("*")),
				},
			},
		},
	}
}

func loadSigningKey(ctx context.Context) []byte {
	secretID := internal.EnvStringOrFatal("SIGNING_KEY_SECRET_ARN")
	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		panic("failed to load AWS config: " + err.Error())
	}
	client := secretsmanager.NewFromConfig(cfg)
	output, err := client.GetSecretValue(ctx, &secretsmanager.GetSecretValueInput{
		SecretId: &secretID,
	})
	if err != nil {
		panic("failed to retrieve signing key secret: " + err.Error())
	}
	return []byte(*output.SecretString)
}
