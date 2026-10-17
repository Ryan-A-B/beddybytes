package accountrepository

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
)

func TestQueryLicenseReplay(t *testing.T) {
	const trialStart int64 = 1700000000
	const provisionalStart int64 = 1700100000
	const revokedAt int64 = 1700200000
	const perpetualStart int64 = 1700300000
	created := eventlog.Event{Type: events.TypeAccountCreatedV2, UnixTimestamp: trialStart, Data: json.RawMessage(`{"account_id":"account-1","user":{"id":{"Issuer":"google","Subject":"user-1"}}}`)}
	provisional := eventlog.Event{Type: events.TypeProvisionalLicenseGranted, AccountID: "account-1", UnixTimestamp: provisionalStart}
	revoked := eventlog.Event{Type: events.TypeProvisionalLicenseRevoked, AccountID: "account-1", UnixTimestamp: revokedAt}
	perpetual := eventlog.Event{Type: events.TypePerpetualLicenseGranted, AccountID: "account-1", UnixTimestamp: perpetualStart}
	for _, test := range []struct {
		name    string
		history []eventlog.Event
		want    models.License
	}{
		{name: "v1 perpetual", history: []eventlog.Event{{Type: events.TypeAccountCreatedV1, UnixTimestamp: trialStart, Data: json.RawMessage(`{"id":"account-1","user":{"email":"legacy@example.com"}}`)}}, want: models.License{Type: models.LicenseTypePerpetual, StartUnixSeconds: trialStart}},
		{name: "v2 trial", history: []eventlog.Event{created}, want: models.NewTrialLicense(trialStart)},
		{name: "provisional preserves trial start", history: []eventlog.Event{created, provisional}, want: models.License{Type: models.LicenseTypeProvisional, StartUnixSeconds: provisionalStart, ProvisionalLicense: &models.ProvisionalLicense{TrialStartUnixSeconds: trialStart}}},
		{name: "revocation restores trial start", history: []eventlog.Event{created, provisional, revoked}, want: models.NewTrialLicense(trialStart)},
		{name: "direct perpetual grant", history: []eventlog.Event{created, perpetual}, want: models.License{Type: models.LicenseTypePerpetual, StartUnixSeconds: perpetualStart}},
		{name: "perpetual replaces provisional", history: []eventlog.Event{created, provisional, perpetual}, want: models.License{Type: models.LicenseTypePerpetual, StartUnixSeconds: perpetualStart}},
		{name: "grant after revocation preserves original trial", history: []eventlog.Event{created, provisional, revoked, {Type: events.TypeProvisionalLicenseGranted, AccountID: "account-1", UnixTimestamp: perpetualStart}}, want: models.License{Type: models.LicenseTypeProvisional, StartUnixSeconds: perpetualStart, ProvisionalLicense: &models.ProvisionalLicense{TrialStartUnixSeconds: trialStart}}},
	} {
		t.Run(test.name, func(t *testing.T) {
			// Distinct durable timestamps make resetting the trial during revocation
			// observable without sleeps or a production clock override.
			history := append([]eventlog.Event(nil), test.history...)
			history = append(history, eventlog.Event{Type: events.TypeAccountCreatedV2, UnixTimestamp: trialStart, Data: json.RawMessage(`{"account_id":"account-2","user":{"id":{"Issuer":"google","Subject":"user-2"}}}`)})
			var persisted bytes.Buffer
			for index, event := range history {
				event.LogicalClock = int64(index + 1)
				if err := json.NewEncoder(&persisted).Encode(event); err != nil {
					t.Fatal(err)
				}
			}
			directory := t.TempDir()
			if err := os.WriteFile(filepath.Join(directory, eventlog.EventsFileName), persisted.Bytes(), 0600); err != nil {
				t.Fatal(err)
			}
			log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: directory})
			handler := NewQueryHandler(NewQueryHandlerInput{EventLog: log})
			for query := 0; query < 3; query++ {
				if query == 2 {
					handler = NewQueryHandler(NewQueryHandlerInput{EventLog: log})
				}
				license, err := handler.GetLicenseForAccount(context.Background(), "account-1")
				if err != nil {
					t.Fatal(err)
				}
				if !reflect.DeepEqual(*license, test.want) {
					t.Fatalf("query %d: license=%+v, want %+v", query, *license, test.want)
				}
				active, err := handler.HasActiveAccount(context.Background(), "account-1")
				wantActive := test.want.Type != models.LicenseTypeTrial
				if err != nil || active != wantActive {
					t.Fatalf("query %d: active=%v err=%v, want %v", query, active, err, wantActive)
				}
			}
			other, err := handler.GetLicenseForAccount(context.Background(), "account-2")
			if err != nil || other.Type != models.LicenseTypeTrial || other.StartUnixSeconds != trialStart {
				t.Fatalf("other account changed: license=%+v err=%v", other, err)
			}
		})
	}
}

func TestQueryLicenseCatchesUpNewEvents(t *testing.T) {
	ctx := context.Background()
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{FolderPath: t.TempDir()})
	handler := NewQueryHandler(NewQueryHandlerInput{EventLog: log})
	if _, err := handler.GetLicenseForAccount(ctx, "account-1"); !errors.Is(err, ErrAccountNotFound) {
		t.Fatalf("unknown account error=%v", err)
	}
	if active, err := handler.HasActiveAccount(ctx, "account-1"); active || !errors.Is(err, ErrAccountNotFound) {
		t.Fatalf("unknown account active=%v error=%v", active, err)
	}
	if _, err := log.Append(ctx, eventlog.AppendInput{Type: events.TypeAccountCreatedV2, Data: json.RawMessage(`{"account_id":"account-1","user":{"id":{"Issuer":"google","Subject":"user-1"}}}`)}); err != nil {
		t.Fatal(err)
	}
	for _, step := range []struct {
		eventType eventlog.EventType
		want      models.LicenseType
	}{
		{want: models.LicenseTypeTrial},
		{eventType: events.TypeProvisionalLicenseGranted, want: models.LicenseTypeProvisional},
		{eventType: events.TypeProvisionalLicenseRevoked, want: models.LicenseTypeTrial},
		{eventType: events.TypePerpetualLicenseGranted, want: models.LicenseTypePerpetual},
	} {
		if step.eventType != "" {
			if _, err := log.Append(ctx, eventlog.AppendInput{Type: step.eventType, AccountID: "account-1"}); err != nil {
				t.Fatal(err)
			}
		}
		license, err := handler.GetLicenseForAccount(ctx, "account-1")
		if err != nil || license.Type != step.want {
			t.Fatalf("license=%+v err=%v, want %s", license, err, step.want)
		}
		if active, err := handler.HasActiveAccount(ctx, "account-1"); err != nil || !active {
			t.Fatalf("current account active=%v error=%v", active, err)
		}
	}
}

func TestHasActiveLicenseTrialExpiryBoundary(t *testing.T) {
	const start int64 = 1700000000
	const end = start + 604800
	for _, test := range []struct {
		name        string
		licenseType models.LicenseType
		now         int64
		want        bool
	}{
		{"trial before expiry", models.LicenseTypeTrial, end - 1, true},
		{"trial at expiry", models.LicenseTypeTrial, end, false},
		{"trial after expiry", models.LicenseTypeTrial, end + 1, false},
		{"perpetual", models.LicenseTypePerpetual, end + 100000, true},
		{"provisional", models.LicenseTypeProvisional, end + 100000, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			license := models.NewTrialLicense(start)
			license.Type = test.licenseType
			if test.licenseType != models.LicenseTypeTrial {
				license.EndUnixSeconds = nil
			}
			if got := hasActiveLicense(license, time.Unix(test.now, 0)); got != test.want {
				t.Fatalf("active=%v, want %v", got, test.want)
			}
		})
	}
}

func TestHasActiveLicenseUsesStoredEnd(t *testing.T) {
	const start int64 = 1700000000
	end := start + 60
	license := models.License{Type: models.LicenseTypeTrial, StartUnixSeconds: start, EndUnixSeconds: &end}
	if hasActiveLicense(license, time.Unix(end, 0)) {
		t.Fatal("license should expire at its stored end, without recomputing trial duration")
	}
	license.EndUnixSeconds = nil
	if !hasActiveLicense(license, time.Unix(start+1000000, 0)) {
		t.Fatal("license without an end should remain active")
	}
}
