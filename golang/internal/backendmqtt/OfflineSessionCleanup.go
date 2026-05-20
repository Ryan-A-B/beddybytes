package backendmqtt

import (
	"context"
	"sync"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/logx"
)

const EventTypeSessionRemoved = "session.removed"
const RemoveSessionReasonCleanupAfterClientOffline = "cleanup_after_client_offline"

type RemoveSessionEventData struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

type OfflineSessionCleanupScheduler struct {
	eventLog eventlog.EventLog
	retain   time.Duration

	mutex              sync.Mutex
	sessionByAccountID map[string]map[string]SessionAnnouncement
	timerByClientKey   map[string]cleanupTimer
}

type NewOfflineSessionCleanupSchedulerInput struct {
	EventLog eventlog.EventLog
	Retain   time.Duration
}

type cleanupTimer struct {
	cancel       context.CancelFunc
	sessionID    string
	connectionID string
}

func NewOfflineSessionCleanupScheduler(input NewOfflineSessionCleanupSchedulerInput) *OfflineSessionCleanupScheduler {
	retain := input.Retain
	if retain == 0 {
		retain = 4 * time.Hour
	}
	return &OfflineSessionCleanupScheduler{
		eventLog:           input.EventLog,
		retain:             retain,
		sessionByAccountID: make(map[string]map[string]SessionAnnouncement),
		timerByClientKey:   make(map[string]cleanupTimer),
	}
}

func (scheduler *OfflineSessionCleanupScheduler) TrackSession(accountID string, announcement SessionAnnouncement) {
	scheduler.CancelClient(accountID, announcement.ClientID)
	scheduler.mutex.Lock()
	defer scheduler.mutex.Unlock()
	sessionByConnectionID := scheduler.sessionByAccountID[accountID]
	if sessionByConnectionID == nil {
		sessionByConnectionID = make(map[string]SessionAnnouncement)
		scheduler.sessionByAccountID[accountID] = sessionByConnectionID
	}
	sessionByConnectionID[announcement.ConnectionID] = announcement
}

func (scheduler *OfflineSessionCleanupScheduler) ForgetSession(accountID string, sessionID string) {
	scheduler.mutex.Lock()
	defer scheduler.mutex.Unlock()
	sessionByConnectionID := scheduler.sessionByAccountID[accountID]
	for connectionID, announcement := range sessionByConnectionID {
		if announcement.SessionID != sessionID {
			continue
		}
		delete(sessionByConnectionID, connectionID)
		scheduler.cancelClientLocked(accountID, announcement.ClientID)
		return
	}
}

func (scheduler *OfflineSessionCleanupScheduler) CancelClient(accountID string, clientID string) {
	scheduler.mutex.Lock()
	defer scheduler.mutex.Unlock()
	scheduler.cancelClientLocked(accountID, clientID)
}

func (scheduler *OfflineSessionCleanupScheduler) cancelClientLocked(accountID string, clientID string) {
	key := accountClientKey(accountID, clientID)
	timer, ok := scheduler.timerByClientKey[key]
	if !ok {
		return
	}
	timer.cancel()
	delete(scheduler.timerByClientKey, key)
}

func (scheduler *OfflineSessionCleanupScheduler) Schedule(accountID string, clientID string, connectionID string) {
	scheduler.mutex.Lock()
	sessionByConnectionID := scheduler.sessionByAccountID[accountID]
	announcement, ok := sessionByConnectionID[connectionID]
	if !ok {
		scheduler.mutex.Unlock()
		return
	}
	scheduler.cancelClientLocked(accountID, clientID)
	ctx, cancel := context.WithCancel(context.Background())
	key := accountClientKey(accountID, clientID)
	scheduler.timerByClientKey[key] = cleanupTimer{
		cancel:       cancel,
		sessionID:    announcement.SessionID,
		connectionID: announcement.ConnectionID,
	}
	scheduler.mutex.Unlock()

	go scheduler.removeSessionAfterClientOffline(ctx, accountID, clientID, announcement)
}

func (scheduler *OfflineSessionCleanupScheduler) removeSessionAfterClientOffline(ctx context.Context, accountID string, clientID string, announcement SessionAnnouncement) {
	waitTimer := time.NewTimer(scheduler.retain)
	defer waitTimer.Stop()
	select {
	case <-ctx.Done():
		return
	case <-waitTimer.C:
	}

	scheduler.mutex.Lock()
	key := accountClientKey(accountID, clientID)
	registeredTimer, ok := scheduler.timerByClientKey[key]
	if !ok || registeredTimer.sessionID != announcement.SessionID || registeredTimer.connectionID != announcement.ConnectionID {
		scheduler.mutex.Unlock()
		return
	}
	registeredTimer.cancel()
	delete(scheduler.timerByClientKey, key)
	sessionByConnectionID := scheduler.sessionByAccountID[accountID]
	delete(sessionByConnectionID, announcement.ConnectionID)
	scheduler.mutex.Unlock()

	_, err := scheduler.eventLog.Append(context.Background(), eventlog.AppendInput{
		Type:      EventTypeSessionRemoved,
		AccountID: accountID,
		Data: fatal.UnlessMarshalJSON(RemoveSessionEventData{
			ID:     announcement.SessionID,
			Reason: RemoveSessionReasonCleanupAfterClientOffline,
		}),
	})
	if err != nil {
		logx.Errorln(err)
	}
}
