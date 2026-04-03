package sessionstartdecider_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/sessionstartdecider"
)

func TestDeciderAllowsRestartAfterSessionEnded(t *testing.T) {
	ctx := context.Background()
	folderPath, err := os.MkdirTemp("", "TestDeciderAllowsRestartAfterSessionEnded-*")
	if err != nil {
		t.Fatal(err)
	}
	eventLog := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
		FolderPath: folderPath,
	})
	decider := sessionstartdecider.NewDecider(sessionstartdecider.NewDeciderInput{
		EventLog: eventLog,
	})
	session := sessionstartdecider.Session{
		AccountID:        "account-1",
		ID:               "session-1",
		Name:             "nursery",
		HostConnectionID: "connection-1",
		StartedAt:        time.Unix(1, 0).UTC(),
	}
	if err := decider.Put(ctx, session); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(struct {
		ID string `json:"id"`
	}{
		ID: session.ID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := eventLog.Append(ctx, eventlog.AppendInput{
		Type:      "session.ended",
		AccountID: session.AccountID,
		Data:      data,
	}); err != nil {
		t.Fatal(err)
	}
	restarted := session
	restarted.ID = "session-2"
	restarted.StartedAt = restarted.StartedAt.Add(time.Minute)
	if err := decider.Put(ctx, restarted); err != nil {
		t.Fatalf("expected session start after clean end to succeed, got %v", err)
	}
}

func TestDeciderAllowsRestartWithoutSessionEnded(t *testing.T) {
	ctx := context.Background()
	folderPath, err := os.MkdirTemp("", "TestDeciderAllowsRestartWithoutSessionEnded-*")
	if err != nil {
		t.Fatal(err)
	}
	eventLog := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
		FolderPath: folderPath,
	})
	decider := sessionstartdecider.NewDecider(sessionstartdecider.NewDeciderInput{
		EventLog: eventLog,
	})
	first := sessionstartdecider.Session{
		AccountID:        "account-1",
		ID:               "session-1",
		Name:             "nursery",
		HostConnectionID: "connection-1",
		StartedAt:        time.Unix(1, 0).UTC(),
	}
	if err := decider.Put(ctx, first); err != nil {
		t.Fatal(err)
	}
	second := first
	second.ID = "session-2"
	second.StartedAt = second.StartedAt.Add(time.Minute)
	if err := decider.Put(ctx, second); err != nil {
		t.Fatalf("expected replacement start without session.ended, got %v", err)
	}
}

func TestDeciderRejectsLateStartForEndedSession(t *testing.T) {
	ctx := context.Background()
	folderPath, err := os.MkdirTemp("", "TestDeciderRejectsLateStartForEndedSession-*")
	if err != nil {
		t.Fatal(err)
	}
	eventLog := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
		FolderPath: folderPath,
	})
	decider := sessionstartdecider.NewDecider(sessionstartdecider.NewDeciderInput{
		EventLog: eventLog,
	})
	session := sessionstartdecider.Session{
		AccountID:        "account-1",
		ID:               "session-1",
		Name:             "nursery",
		HostConnectionID: "connection-1",
		StartedAt:        time.Unix(1, 0).UTC(),
	}
	data, err := json.Marshal(struct {
		ID string `json:"id"`
	}{
		ID: session.ID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := eventLog.Append(ctx, eventlog.AppendInput{
		Type:      "session.ended",
		AccountID: session.AccountID,
		Data:      data,
	}); err != nil {
		t.Fatal(err)
	}
	if err := decider.Put(ctx, session); err != sessionstartdecider.ErrDuplicate {
		t.Fatalf("expected late start for ended session to be rejected, got %v", err)
	}
	restarted := session
	restarted.ID = "session-2"
	restarted.StartedAt = restarted.StartedAt.Add(time.Minute)
	if err := decider.Put(ctx, restarted); err != nil {
		t.Fatalf("expected new session after stale late start to succeed, got %v", err)
	}
}
