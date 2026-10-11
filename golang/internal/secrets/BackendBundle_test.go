package secrets

import (
	"strings"
	"testing"
)

func TestParseBackendBundle(t *testing.T) {
	for name, data := range map[string]string{
		"full bundle":      `{"ENCRYPTION_KEY":"key","GOOGLE_CLIENT_ID":"client-id","GOOGLE_CLIENT_SECRET":"client-secret"}`,
		"signing key only": `{"ENCRYPTION_KEY":"key"}`,
		"additional field": `{"ENCRYPTION_KEY":"key","FUTURE_SETTING":"value"}`,
	} {
		t.Run(name, func(t *testing.T) {
			bundle, err := ParseBackendBundle(&data)
			if err != nil || bundle.EncryptionKey != "key" {
				t.Fatal("valid signing key bundle rejected")
			}
			if name == "full bundle" && (bundle.GoogleClientID != "client-id" || bundle.GoogleClientSecret != "client-secret") {
				t.Fatal("Google credentials were not decoded")
			}
		})
	}
}

func TestParseBackendBundleRejectsInvalidSecretsWithoutLeakingValues(t *testing.T) {
	for _, data := range []string{
		"", "legacy-raw-key", "null", `[]`,
		`{"GOOGLE_CLIENT_SECRET":"sensitive-value"}`,
		`{"ENCRYPTION_KEY":""}`, `{"ENCRYPTION_KEY":null}`, `{"ENCRYPTION_KEY":123}`,
		`{"ENCRYPTION_KEY":"sensitive-value"`,
		`{"ENCRYPTION_KEY":"key","GOOGLE_CLIENT_SECRET":{"sensitive-value":true}}`,
	} {
		if _, err := ParseBackendBundle(&data); err == nil {
			t.Fatal("invalid secret bundle accepted")
		} else if strings.Contains(err.Error(), "sensitive-value") {
			t.Fatal("error leaked a secret value")
		}
	}
	if _, err := ParseBackendBundle(nil); err == nil {
		t.Fatal("binary-only secret accepted")
	}
}
