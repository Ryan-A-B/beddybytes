package babystationlist

import (
	"context"
	"encoding/json"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/connections"
	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
)

type Snapshot struct {
	SessionByID             map[string]*Session    `json:"session_by_id"`
	SessionIDByConnectionID map[string]string      `json:"session_id_by_connection_id"`
	ConnectionByID          map[string]*Connection `json:"connection_by_id"`
}

func (snapshot *Snapshot) List() []BabyStation {
	babyStations := make([]BabyStation, 0, len(snapshot.ConnectionByID))
	for connectionID, connection := range snapshot.ConnectionByID {
		sessionID, ok := snapshot.SessionIDByConnectionID[connectionID]
		fatal.Unless(ok, "session not found: "+sessionID)
		session, ok := snapshot.SessionByID[sessionID]
		fatal.Unless(ok, "session not found: "+sessionID)
		babyStation := BabyStation{
			Name:     session.Name,
			ClientID: connection.ClientID,
			Connection: BabyStationConnection{
				ID:        connection.ID,
				RequestID: connection.RequestID,
			},
			StartedAt: session.StartedAt,
		}
		babyStations = append(babyStations, babyStation)
	}
	return babyStations
}

type BabyStation struct {
	Name       string                `json:"name"`
	ClientID   string                `json:"client_id"`
	Connection BabyStationConnection `json:"connection"`
	StartedAt  time.Time             `json:"started_at"`
}

type BabyStationConnection struct {
	ID        string `json:"id"`
	RequestID string `json:"request_id"`
}

type BabyStationList struct {
	eventLog            eventlog.EventLog
	cursor              int64
	snapshotByAccountID map[string]*Snapshot
}

type NewInput struct {
	EventLog eventlog.EventLog
}

func New(input NewInput) *BabyStationList {
	return &BabyStationList{
		eventLog:            input.EventLog,
		cursor:              0,
		snapshotByAccountID: make(map[string]*Snapshot),
	}
}

type GetSnapshotOutput struct {
	Cursor int64 `json:"cursor"`
	*Snapshot
}

func (babyStationList *BabyStationList) GetSnapshot(ctx context.Context) (output GetSnapshotOutput, err error) {
	babyStationList.catchup(ctx)
	output.Cursor = babyStationList.cursor
	accountID := contextx.GetAccountID(ctx)
	snapshot, ok := babyStationList.snapshotByAccountID[accountID]
	if !ok {
		snapshot = babyStationList.createSnapshot()
	}
	output.Snapshot = snapshot
	return
}

type Connection struct {
	ClientID  string `json:"client_id"`
	ID        string `json:"id"`
	RequestID string `json:"request_id"`
}

func (babyStationList *BabyStationList) catchup(ctx context.Context) {
	eventIterator := babyStationList.eventLog.GetEventIterator(ctx, eventlog.GetEventIteratorInput{
		FromCursor: babyStationList.cursor,
	})
	for eventIterator.Next(ctx) {
		event := eventIterator.Event()
		babyStationList.apply(event)
		babyStationList.cursor = event.LogicalClock
	}
	err := eventIterator.Err()
	if err != nil {
		panic(err)
	}
}

func (babyStationList *BabyStationList) apply(event *eventlog.Event) {
	switch event.Type {
	case EventTypeSessionStarted:
		babyStationList.applySessionStarted(event)
	case EventTypeSessionEnded:
		babyStationList.applySessionEnded(event)
	case connections.EventTypeConnected:
		babyStationList.applyConnected(event)
	case connections.EventTypeDisconnected:
		babyStationList.applyDisconnected(event)
	case EventTypeServerStarted:
		babyStationList.applyServerStarted()
	}
}

func (babyStationList *BabyStationList) applySessionStarted(event *eventlog.Event) {
	var data StartSessionEventData
	err := json.Unmarshal(event.Data, &data)
	fatal.OnError(err)
	session := Session{
		AccountID:        event.AccountID,
		ID:               data.ID,
		Name:             data.Name,
		HostConnectionID: data.HostConnectionID,
		StartedAt:        data.StartedAt,
	}
	snapshot := babyStationList.getOrCreateSnapshot(event.AccountID)
	snapshot.SessionByID[data.ID] = &session
	snapshot.SessionIDByConnectionID[data.HostConnectionID] = data.ID
}

func (babyStationList *BabyStationList) applySessionEnded(event *eventlog.Event) {
	var data EndSessionEventData
	err := json.Unmarshal(event.Data, &data)
	fatal.OnError(err)
	snapshot := babyStationList.getOrCreateSnapshot(event.AccountID)
	session, ok := snapshot.SessionByID[data.ID]
	if !ok {
		return
	}
	delete(snapshot.SessionByID, data.ID)
	delete(snapshot.SessionIDByConnectionID, session.HostConnectionID)
}

func (babyStationList *BabyStationList) applyConnected(event *eventlog.Event) {
	var data connections.EventConnected
	err := json.Unmarshal(event.Data, &data)
	fatal.OnError(err)
	snapshot := babyStationList.getOrCreateSnapshot(event.AccountID)
	connection := Connection{
		ClientID:  data.ClientID,
		ID:        data.ConnectionID,
		RequestID: data.RequestID,
	}
	snapshot.ConnectionByID[data.ConnectionID] = &connection
}

func (babyStationList *BabyStationList) applyDisconnected(event *eventlog.Event) {
	var data connections.EventDisconnected
	err := json.Unmarshal(event.Data, &data)
	fatal.OnError(err)
	snapshot := babyStationList.getOrCreateSnapshot(event.AccountID)
	delete(snapshot.ConnectionByID, data.ConnectionID)
}

func (babyStationList *BabyStationList) applyServerStarted() {
	for _, snapshot := range babyStationList.snapshotByAccountID {
		snapshot.ConnectionByID = make(map[string]*Connection)
		snapshot.cleanUpOldSessions()
	}
}

func (snapshot *Snapshot) cleanUpOldSessions() {
	now := time.Now()
	threshold := now.Add(-3 * 24 * time.Hour)
	for _, session := range snapshot.SessionByID {
		if session.StartedAt.After(threshold) {
			continue
		}
		delete(snapshot.SessionByID, session.ID)
		delete(snapshot.SessionIDByConnectionID, session.HostConnectionID)
	}
}

func (babyStationList *BabyStationList) getOrCreateSnapshot(accountID string) *Snapshot {
	snapshot, ok := babyStationList.snapshotByAccountID[accountID]
	if !ok {
		snapshot = babyStationList.createSnapshot()
		babyStationList.snapshotByAccountID[accountID] = snapshot
	}
	return snapshot
}

func (babystationlist *BabyStationList) createSnapshot() *Snapshot {
	return &Snapshot{
		SessionByID:             make(map[string]*Session),
		SessionIDByConnectionID: make(map[string]string),
		ConnectionByID:          make(map[string]*Connection),
	}
}

// Copied from golang/cmd/backend/sessions.go
const EventTypeSessionStarted = "session.started"
const EventTypeSessionEnded = "session.ended"

type StartSessionEventData struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	HostConnectionID string    `json:"host_connection_id"`
	StartedAt        time.Time `json:"started_at"`
}

type EndSessionEventData struct {
	ID string `json:"id"`
}

type Session struct {
	AccountID        string    `json:"-"`
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	HostConnectionID string    `json:"host_connection_id"`
	StartedAt        time.Time `json:"started_at"`
}

// Copied from golang/cmd/backend/server.go
const EventTypeServerStarted = "server.started"
