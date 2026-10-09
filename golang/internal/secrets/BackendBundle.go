package secrets

import (
	"encoding/json"
	"errors"
)

// BackendBundle is the JSON structure shared by the per-environment backend
// secrets in AWS Secrets Manager.
type BackendBundle struct {
	EncryptionKey      string `json:"ENCRYPTION_KEY"`
	GoogleClientID     string `json:"GOOGLE_CLIENT_ID"`
	GoogleClientSecret string `json:"GOOGLE_CLIENT_SECRET"`
}

func ParseBackendBundle(secretString *string) (BackendBundle, error) {
	if secretString == nil {
		return BackendBundle{}, errors.New("expected a string secret bundle")
	}
	var bundle BackendBundle
	if err := json.Unmarshal([]byte(*secretString), &bundle); err != nil {
		// JSON errors can include secret values. Return a safe error instead.
		return BackendBundle{}, errors.New("expected a JSON backend secret bundle with string values")
	}
	if bundle.EncryptionKey == "" {
		return BackendBundle{}, errors.New("ENCRYPTION_KEY must be a nonempty string")
	}
	// Google credentials are optional for consumers such as the IoT authorizer,
	// which only need the signing key.
	return bundle, nil
}
