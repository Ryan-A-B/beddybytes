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
		{name: "v2 trial", history: []eventlog.Event{created}, want: models.License{Type: models.LicenseTypeTrial, StartUnixSeconds: trialStart}},
		{name: "provisional preserves trial start", history: []eventlog.Event{created, provisional}, want: models.License{Type: models.LicenseTypeProvisional, StartUnixSeconds: provisionalStart, ProvisionalLicense: &models.ProvisionalLicense{TrialStartUnixSeconds: trialStart}}},
		{name: "revocation restores trial start", history: []eventlog.Event{created, provisional, revoked}, want: models.License{Type: models.LicenseTypeTrial, StartUnixSeconds: trialStart}},
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
	}
}
