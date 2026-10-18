package models

import "time"

const TrialDuration = 7 * 24 * time.Hour

type LicenseType string

const (
	// All new accounts start with a trial license
	LicenseTypeTrial LicenseType = "trial"
	// Provisional license is granted temporarily while payment is processing
	LicenseTypeProvisional LicenseType = "provisional"
	// Perpetual license is granted after successful payment
	LicenseTypePerpetual LicenseType = "perpetual"
)

type License struct {
	Type               LicenseType         `json:"type"`
	EndUnixSeconds     *int64              `json:"end_unix_seconds,omitempty"`
	StartUnixSeconds   int64               `json:"start_unix_seconds"`
	ProvisionalLicense *ProvisionalLicense `json:"provisional_license,omitempty"`
}

type ProvisionalLicense struct {
	TrialStartUnixSeconds int64 `json:"trial_start_unix_seconds"`
}

func NewTrialLicense(startUnixSeconds int64) License {
	endUnixSeconds := startUnixSeconds + int64(TrialDuration/time.Second)
	return License{
		Type:             LicenseTypeTrial,
		StartUnixSeconds: startUnixSeconds,
		EndUnixSeconds:   &endUnixSeconds,
	}
}
