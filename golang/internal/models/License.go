package models

import "time"

const TrialDuration = 7 * 24 * time.Hour

type LicenseType string

const (
	// All new accounts start with a trial license
	LicenseTypeTrial LicenseType = "Trial"
	// Provisional license is granted temporarily while payment is processing
	LicenseTypeProvisional LicenseType = "Provisional"
	// Perpetual license is granted after successful payment
	LicenseTypePerpetual LicenseType = "Perpetual"
)

type License struct {
	Type               LicenseType         `json:"type"`
	StartUnixSeconds   int64               `json:"start_unix_seconds"`
	ProvisionalLicense *ProvisionalLicense `json:"provisional_license,omitempty"`
}

type ProvisionalLicense struct {
	TrialStartUnixSeconds int64 `json:"trial_start_unix_seconds"`
}
