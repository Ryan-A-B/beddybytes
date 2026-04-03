package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	"github.com/gorilla/mux"

	"github.com/Ryan-A-B/beddybytes/golang/internal/babystationlist"
	"github.com/Ryan-A-B/beddybytes/golang/internal/connections"
	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/sessionstartdecider"
)

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
	if output.SessionID != payload.ID {
		t.Fatalf("unexpected session id: %q", output.SessionID)
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

func TestParseStartSessionInputRejectsRefactorPayload(t *testing.T) {
	sessionID := "session-123"
	payload := CreateSessionInput{
		SessionID:       sessionID,
		ClientID:        "client-123",
		ConnectionID:    "connection-123",
		Name:            "nursery",
		StartedAtMillis: time.Now().UnixMilli(),
	}
	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := parseStartSessionInput(data, sessionID); err == nil {
		t.Fatal("expected refactor payload to be rejected")
	}
}

func TestEndSessionAllowsRestartOnSameConnection(t *testing.T) {
	ctx := context.Background()
	folderPath, err := os.MkdirTemp("", "TestEndSessionAllowsRestartOnSameConnection-*")
	if err != nil {
		t.Fatal(err)
	}
	eventLog := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
		FolderPath: folderPath,
	})
	decider := sessionstartdecider.NewDecider(sessionstartdecider.NewDeciderInput{
		EventLog: eventLog,
	})
	handlers := Handlers{
		EventLog: eventLog,
	}
	accountID := "account-1"
	first := sessionstartdecider.Session{
		AccountID:        accountID,
		ID:               "session-1",
		Name:             "nursery",
		HostConnectionID: "connection-1",
		StartedAt:        time.Unix(1, 0).UTC(),
	}
	if err := decider.Put(ctx, first); err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodDelete, "/sessions/session-1", nil)
	request = request.WithContext(contextx.WithAccountID(request.Context(), accountID))
	request = mux.SetURLVars(request, map[string]string{
		"session_id": first.ID,
	})
	responseWriter := httptest.NewRecorder()
	handlers.EndSession(responseWriter, request)
	if responseWriter.Code != http.StatusOK {
		t.Fatalf("unexpected status code: %d", responseWriter.Code)
	}

	second := first
	second.ID = "session-2"
	second.StartedAt = second.StartedAt.Add(time.Minute)
	if err := decider.Put(ctx, second); err != nil {
		t.Fatalf("expected restart after delete to succeed, got %v", err)
	}
}

func TestSecondBabyStationAnnouncementShowsInSnapshotAfterLegacyDelete(t *testing.T) {
	ctx := context.Background()
	folderPath, err := os.MkdirTemp("", "TestSecondBabyStationAnnouncementShowsInSnapshotAfterLegacyDelete-*")
	if err != nil {
		t.Fatal(err)
	}
	eventLog := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
		FolderPath: folderPath,
	})
	accountID := "account-1"
	clientID := "client-1"
	connectionID := "connection-1"
	handlers := Handlers{
		EventLog: eventLog,
		SessionStartDecider: sessionstartdecider.NewDecider(sessionstartdecider.NewDeciderInput{
			EventLog: eventLog,
		}),
	}
	if _, err := eventLog.Append(contextx.WithAccountID(ctx, accountID), eventlog.AppendInput{
		Type:      connections.EventTypeConnected,
		AccountID: accountID,
		Data: mustJSON(t, connections.EventConnected{
			ClientID:     clientID,
			ConnectionID: connectionID,
		}),
	}); err != nil {
		t.Fatal(err)
	}

	handlers.handleBabyStationsMessage(nil, testMQTTMessage{
		topic: "accounts/account-1/baby_stations",
		payload: mustJSON(t, babyStationAnnouncement{
			SessionID:       "session-1",
			ClientID:        clientID,
			ConnectionID:    connectionID,
			Name:            "first",
			StartedAtMillis: time.Unix(1, 0).UnixMilli(),
		}),
	})

	request := httptest.NewRequest(http.MethodDelete, "/sessions/session-1", nil)
	request = request.WithContext(contextx.WithAccountID(request.Context(), accountID))
	request = mux.SetURLVars(request, map[string]string{"session_id": "session-1"})
	responseWriter := httptest.NewRecorder()
	handlers.EndSession(responseWriter, request)
	if responseWriter.Code != http.StatusOK {
		t.Fatalf("unexpected delete status code: %d", responseWriter.Code)
	}

	handlers.handleBabyStationsMessage(nil, testMQTTMessage{
		topic: "accounts/account-1/baby_stations",
		payload: mustJSON(t, babyStationAnnouncement{
			SessionID:       "session-2",
			ClientID:        clientID,
			ConnectionID:    connectionID,
			Name:            "second",
			StartedAtMillis: time.Unix(2, 0).UnixMilli(),
		}),
	})

	list := babystationlist.New(babystationlist.NewInput{
		EventLog: eventLog,
	})
	output, err := list.GetSnapshot(contextx.WithAccountID(ctx, accountID))
	if err != nil {
		t.Fatal(err)
	}
	if got := len(output.Snapshot.List()); got != 1 {
		t.Fatalf("expected one baby station, got %d", got)
	}
	if got := output.Snapshot.List()[0].SessionID; got != "session-2" {
		t.Fatalf("expected session-2, got %q", got)
	}
	if got := output.Snapshot.List()[0].Name; got != "second" {
		t.Fatalf("expected second session name, got %q", got)
	}
}

func TestEventsStreamIncludesDeleteThenRestartOnSameConnection(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	folderPath, err := os.MkdirTemp("", "TestEventsStreamIncludesDeleteThenRestartOnSameConnection-*")
	if err != nil {
		t.Fatal(err)
	}
	eventLog := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
		FolderPath: folderPath,
	})
	accountID := "account-1"
	clientID := "client-1"
	connectionID := "connection-1"
	handlers := Handlers{
		EventLog: eventLog,
		SessionStartDecider: sessionstartdecider.NewDecider(sessionstartdecider.NewDeciderInput{
			EventLog: eventLog,
		}),
	}
	accountCtx := contextx.WithAccountID(ctx, accountID)
	if _, err := eventLog.Append(accountCtx, eventlog.AppendInput{
		Type:      connections.EventTypeConnected,
		AccountID: accountID,
		Data: mustJSON(t, connections.EventConnected{
			ClientID:     clientID,
			ConnectionID: connectionID,
		}),
	}); err != nil {
		t.Fatal(err)
	}
	handlers.handleBabyStationsMessage(nil, testMQTTMessage{
		topic: "accounts/account-1/baby_stations",
		payload: mustJSON(t, babyStationAnnouncement{
			SessionID:       "session-1",
			ClientID:        clientID,
			ConnectionID:    connectionID,
			Name:            "first",
			StartedAtMillis: time.Unix(1, 0).UnixMilli(),
		}),
	})

	request := httptest.NewRequest(http.MethodGet, "/events?from_cursor=2", nil)
	request = request.WithContext(accountCtx)
	responseWriter := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		defer close(done)
		handlers.GetEvents(responseWriter, request)
	}()

	deleteRequest := httptest.NewRequest(http.MethodDelete, "/sessions/session-1", nil)
	deleteRequest = deleteRequest.WithContext(contextx.WithAccountID(context.Background(), accountID))
	deleteRequest = mux.SetURLVars(deleteRequest, map[string]string{"session_id": "session-1"})
	deleteResponseWriter := httptest.NewRecorder()
	handlers.EndSession(deleteResponseWriter, deleteRequest)
	if deleteResponseWriter.Code != http.StatusOK {
		t.Fatalf("unexpected delete status code: %d", deleteResponseWriter.Code)
	}
	handlers.handleBabyStationsMessage(nil, testMQTTMessage{
		topic: "accounts/account-1/baby_stations",
		payload: mustJSON(t, babyStationAnnouncement{
			SessionID:       "session-2",
			ClientID:        clientID,
			ConnectionID:    connectionID,
			Name:            "second",
			StartedAtMillis: time.Unix(2, 0).UnixMilli(),
		}),
	})

	time.Sleep(50 * time.Millisecond)
	cancel()
	<-done

	body := responseWriter.Body.String()
	if !strings.Contains(body, `"type":"session.ended"`) {
		t.Fatalf("expected session.ended in event stream, got %q", body)
	}
	if !strings.Contains(body, `"type":"session.started"`) {
		t.Fatalf("expected session.started in event stream, got %q", body)
	}
	if !strings.Contains(body, `"id":"session-2"`) {
		t.Fatalf("expected restarted session payload in event stream, got %q", body)
	}
}

type testMQTTMessage struct {
	topic   string
	payload []byte
}

func (message testMQTTMessage) Duplicate() bool { return false }
func (message testMQTTMessage) Qos() byte       { return 1 }
func (message testMQTTMessage) Retained() bool  { return false }
func (message testMQTTMessage) Topic() string   { return message.topic }
func (message testMQTTMessage) MessageID() uint16 {
	return 0
}
func (message testMQTTMessage) Payload() []byte { return message.payload }
func (message testMQTTMessage) Ack()            {}

var _ mqtt.Message = testMQTTMessage{}

func mustJSON(t *testing.T, value any) []byte {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	return data
}
