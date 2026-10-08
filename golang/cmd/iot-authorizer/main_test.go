package main

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/aws/aws-lambda-go/events"
	"github.com/dgrijalva/jwt-go"
)

const testSigningKey = "test-signing-key"

func TestSigningKeyFromSecret(t *testing.T) {
	for _, tc := range []struct {
		name, secret, field string
		wantError           bool
	}{
		{name: "legacy raw key", secret: testSigningKey},
		{name: "bundle key", secret: `{"ENCRYPTION_KEY":"test-signing-key","GOOGLE_CLIENT_SECRET":"other-secret"}`, field: "ENCRYPTION_KEY"},
		{name: "missing field", secret: `{"GOOGLE_CLIENT_SECRET":"other-secret"}`, field: "ENCRYPTION_KEY", wantError: true},
		{name: "empty placeholder", secret: `{"ENCRYPTION_KEY":""}`, field: "ENCRYPTION_KEY", wantError: true},
		{name: "wrong type", secret: `{"ENCRYPTION_KEY":123}`, field: "ENCRYPTION_KEY", wantError: true},
		{name: "null key", secret: `{"ENCRYPTION_KEY":null}`, field: "ENCRYPTION_KEY", wantError: true},
		{name: "malformed bundle", secret: `{"ENCRYPTION_KEY":"sensitive-value"`, field: "ENCRYPTION_KEY", wantError: true},
		{name: "raw key with bundle configured", secret: testSigningKey, field: "ENCRYPTION_KEY", wantError: true},
		{name: "empty raw key", wantError: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			key, err := signingKeyFromSecret(&tc.secret, tc.field)
			if tc.wantError {
				if err == nil {
					t.Fatal("expected invalid signing key to be rejected")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if string(key) != testSigningKey {
				t.Fatal("expected extracted signing key")
			}
			// Use the extracted bundle key to verify a real MQTT access token.
			cfg := testConfig()
			cfg.signingKey = key
			_, err = authorize(newRequest(newAccessToken(t, time.Now().Add(time.Hour), internal.URN{
				Service: "iam", AccountID: "account-1", ResourceType: "user", ResourceID: "user-1",
			}), "client-1"), cfg)
			if err != nil {
				t.Fatal(err)
			}
		})
	}
	if _, err := signingKeyFromSecret(nil, "ENCRYPTION_KEY"); err == nil {
		t.Fatal("expected binary-only secret to be rejected")
	}
}

func TestAuthorizeAllowsAccountScopedMQTTAccessForValidAccessToken(t *testing.T) {
	accessToken := newAccessToken(t, time.Now().Add(time.Hour), internal.URN{
		Service:      "iam",
		AccountID:    "beddybytes-account-1",
		ResourceType: "user",
		ResourceID:   "user-1",
	})
	request := newRequest(accessToken, "client-1")

	response, err := authorize(request, testConfig())

	if err != nil {
		t.Fatal(err)
	}
	if !response.IsAuthenticated {
		t.Fatal("expected request to be authenticated")
	}
	if response.PrincipalID == "" {
		t.Fatal("expected principal ID to be set")
	}
	policy := response.PolicyDocuments[0]
	assertPolicyResources(t, policy, []string{
		"arn:aws:iot:ap-southeast-2:123456789012:client/client-1",
		"arn:aws:iot:ap-southeast-2:123456789012:topic/accounts/beddybytes-account-1/clients/client-1/status",
		"arn:aws:iot:ap-southeast-2:123456789012:topic/accounts/beddybytes-account-1/clients/*/webrtc_inbox",
		"arn:aws:iot:ap-southeast-2:123456789012:topic/accounts/beddybytes-account-1/clients/*/control_inbox",
		"arn:aws:iot:ap-southeast-2:123456789012:topic/accounts/beddybytes-account-1/baby_stations",
		"arn:aws:iot:ap-southeast-2:123456789012:topic/accounts/beddybytes-account-1/parent_stations",
		"arn:aws:iot:ap-southeast-2:123456789012:topic/accounts/beddybytes-account-1/*",
		"arn:aws:iot:ap-southeast-2:123456789012:topicfilter/accounts/beddybytes-account-1/clients/client-1/webrtc_inbox",
		"arn:aws:iot:ap-southeast-2:123456789012:topicfilter/accounts/beddybytes-account-1/clients/client-1/control_inbox",
		"arn:aws:iot:ap-southeast-2:123456789012:topicfilter/accounts/beddybytes-account-1/clients/*/status",
		"arn:aws:iot:ap-southeast-2:123456789012:topicfilter/accounts/beddybytes-account-1/clients/+/status",
		"arn:aws:iot:ap-southeast-2:123456789012:topicfilter/accounts/beddybytes-account-1/baby_stations",
		"arn:aws:iot:ap-southeast-2:123456789012:topicfilter/accounts/beddybytes-account-1/parent_stations",
	})
	connectStatement := policy.Statement[0]
	if connectStatement.Effect != "Allow" {
		t.Fatalf("expected connect policy to allow connect, got %q", connectStatement.Effect)
	}
}

func TestAuthorizeExtractsAccessTokenFromAuthorizationHeader(t *testing.T) {
	accessToken := newAccessToken(t, time.Now().Add(time.Hour), internal.URN{
		Service:      "iam",
		AccountID:    "beddybytes-account-1",
		ResourceType: "user",
		ResourceID:   "user-1",
	})
	request := newRequest("", "client-1")
	request.ProtocolData.HTTP.Headers = map[string]string{
		"authorization": "Bearer " + accessToken,
	}

	response, err := authorize(request, testConfig())

	if err != nil {
		t.Fatal(err)
	}
	if !response.IsAuthenticated {
		t.Fatal("expected request to be authenticated")
	}
}

func TestAuthorizeRejectsExpiredAccessToken(t *testing.T) {
	accessToken := newAccessToken(t, time.Now().Add(-time.Hour), internal.URN{
		Service:      "iam",
		AccountID:    "beddybytes-account-1",
		ResourceType: "user",
		ResourceID:   "user-1",
	})

	_, err := authorize(newRequest(accessToken, "client-1"), testConfig())

	if err == nil {
		t.Fatal("expected error")
	}
}

func TestAuthorizeRejectsTokenForWrongSubjectType(t *testing.T) {
	accessToken := newAccessToken(t, time.Now().Add(time.Hour), internal.URN{
		Service:      "iam",
		AccountID:    "beddybytes-account-1",
		ResourceType: "remote_address",
		ResourceID:   "127.0.0.1",
	})

	_, err := authorize(newRequest(accessToken, "client-1"), testConfig())

	if err == nil {
		t.Fatal("expected error")
	}
}

func TestAuthorizeRejectsMissingMQTTClientID(t *testing.T) {
	accessToken := newAccessToken(t, time.Now().Add(time.Hour), internal.URN{
		Service:      "iam",
		AccountID:    "beddybytes-account-1",
		ResourceType: "user",
		ResourceID:   "user-1",
	})

	_, err := authorize(newRequest(accessToken, ""), testConfig())

	if err == nil {
		t.Fatal("expected error")
	}
}

func TestPolicyDocumentFitsIOTAuthorizerLimit(t *testing.T) {
	policy := newPolicyDocument("ap-southeast-2", "123456789012", "beddybytes-account-1", "client-1")
	encoded, err := json.Marshal(policy)
	if err != nil {
		t.Fatal(err)
	}
	if len(encoded) > 2048 {
		t.Fatalf("policy document is too large: %d bytes", len(encoded))
	}
}

func newRequest(accessToken string, mqttClientID string) events.IoTCoreCustomAuthorizerRequest {
	return events.IoTCoreCustomAuthorizerRequest{
		ProtocolData: &events.IoTCoreProtocolData{
			HTTP: &events.IoTCoreHTTPContext{
				QueryString: "?access_token=" + accessToken,
			},
			MQTT: &events.IoTCoreMQTTContext{
				ClientID: mqttClientID,
			},
		},
	}
}

func newAccessToken(t *testing.T, expiry time.Time, subject internal.URN) string {
	t.Helper()
	claims := internal.Claims{
		Issuer:   "beddybytes",
		Audience: "beddybytes",
		Subject:  subject,
		Expiry:   expiry.Unix(),
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, &claims).SignedString([]byte(testSigningKey))
	if err != nil {
		t.Fatal(err)
	}
	return accessToken
}

func testConfig() AuthorizerConfig {
	return AuthorizerConfig{
		awsAccountID: "123456789012",
		awsRegion:    "ap-southeast-2",
		signingKey:   []byte(testSigningKey),
	}
}

func assertPolicyResources(t *testing.T, policy *events.IAMPolicyDocument, expectedResources []string) {
	t.Helper()
	resources := map[string]bool{}
	for _, statement := range policy.Statement {
		for _, resource := range statement.Resource {
			resources[resource] = true
		}
	}
	for _, expectedResource := range expectedResources {
		if !resources[expectedResource] {
			t.Fatalf("missing policy resource %s", expectedResource)
		}
	}
}
