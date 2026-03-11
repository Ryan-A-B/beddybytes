package main

import (
	"encoding/json"
	"testing"
	"time"
)

func TestParseStartSessionInputNewPayload(t *testing.T) {
	sessionID := "session-123"
	payload := CreateSessionInput{
		ClientID:        "client-123",
		ConnectionID:    "connection-123",
		Name:            "nursery",
		StartedAtMillis: time.Now().UnixMilli(),
	}
	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	output, err := parseStartSessionInput(data, sessionID)
	if err != nil {
		t.Fatal(err)
	}
	if output.ClientID != payload.ClientID {
		t.Fatalf("unexpected client id: %q", output.ClientID)
	}
	if output.ConnectionID != payload.ConnectionID {
		t.Fatalf("unexpected connection id: %q", output.ConnectionID)
	}
	if output.Name != payload.Name {
		t.Fatalf("unexpected name: %q", output.Name)
	}
	if output.StartedAtMillis != payload.StartedAtMillis {
		t.Fatalf("unexpected started_at_millis: %d", output.StartedAtMillis)
	}
}

func TestParseStartSessionInputLegacyPayload(t *testing.T) {
	sessionID := "session-123"
	startedAt := time.Now().UTC().Truncate(time.Second)
	payload := StartSessionEventData{
		ID:               sessionID,
		Name:             "nursery",
		HostConnectionID: "connection-123",
		StartedAt:        startedAt,
	}
	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	output, err := parseStartSessionInput(data, sessionID)
	if err != nil {
		t.Fatal(err)
	}
	if output.ClientID != "" {
		t.Fatalf("expected empty client id for legacy payload, got %q", output.ClientID)
	}
	if output.ConnectionID != payload.HostConnectionID {
		t.Fatalf("unexpected connection id: %q", output.ConnectionID)
	}
	if output.Name != payload.Name {
		t.Fatalf("unexpected name: %q", output.Name)
	}
	if output.StartedAtMillis != payload.StartedAt.UnixMilli() {
		t.Fatalf("unexpected started_at_millis: %d", output.StartedAtMillis)
	}
}
