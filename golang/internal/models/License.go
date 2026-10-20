package models

import (
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
)

var TrialDuration = internal.EnvDuration("TRIAL_DURATION", 7*24*time.Hour)

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
	Type              LicenseType               `json:"type"`
	StartUnixSeconds  int64                     `json:"start_unix_seconds"`
	TrialDetail       *TrialLicenseDetail       `json:"trial_detail,omitempty"`
	ProvisionalDetail *ProvisionalLicenseDetail `json:"provisional_detail,omitempty"`
}

type TrialLicenseDetail struct {
	EndUnixSeconds int64 `json:"end_unix_seconds"`
}

type ProvisionalLicenseDetail struct {
	TrialStartUnixSeconds int64 `json:"trial_start_unix_seconds"`
}

func NewTrialLicense(startUnixSeconds int64) License {
	start := time.Unix(startUnixSeconds, 0)
	end := start.Add(TrialDuration)
	endUnixSeconds := end.Unix()
	return License{
		Type:             LicenseTypeTrial,
		StartUnixSeconds: startUnixSeconds,
		TrialDetail: &TrialLicenseDetail{
			EndUnixSeconds: endUnixSeconds,
		},
	}
}
