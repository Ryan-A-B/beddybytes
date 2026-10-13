package models

type LicenseType string

const (
	LicenseTypeTrial     LicenseType = "Trial"
	LicenseTypePerpetual LicenseType = "Perpetual"
)

type License struct {
	Type             LicenseType `json:"type"`
	StartUnixSeconds int64       `json:"start_unix_seconds"`
}
