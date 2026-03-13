package main

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
)

type UsageStats struct {
	mutex  sync.Mutex
	log    eventlog.EventLog
	cursor int64

	sessionInfoByID                   map[string]*SessionInfo
	sessionInfoByConnectionID         map[string]*SessionInfo
	disconnectedSessionByConnectionID map[string]*DisconnectedSessionInfo
	disconnectedSessionsByAccountID   map[string][]*DisconnectedSessionInfo
	durationByAccountID               map[string]time.Duration
}

const maxDisconnectedSessionsPerAccount = 4

type NewUsageStatsInput struct {
	Log eventlog.EventLog
}

func NewUsageStats(ctx context.Context, input NewUsageStatsInput) *UsageStats {
	return &UsageStats{
		log:                               input.Log,
		sessionInfoByID:                   make(map[string]*SessionInfo),
		sessionInfoByConnectionID:         make(map[string]*SessionInfo),
		disconnectedSessionByConnectionID: make(map[string]*DisconnectedSessionInfo),
		disconnectedSessionsByAccountID:   make(map[string][]*DisconnectedSessionInfo),
		durationByAccountID:               make(map[string]time.Duration),
	}
}

func (stats *UsageStats) GetTotalDuration(ctx context.Context) time.Duration {
	stats.catchUp(ctx)
	total := time.Duration(0)
	for _, duration := range stats.durationByAccountID {
		total += duration
	}
	for _, sessionInfo := range stats.sessionInfoByID {
		duration := time.Since(sessionInfo.StartTime)
		total += duration
	}
	for _, disconnectedSessions := range stats.disconnectedSessionsByAccountID {
		for _, sessionInfo := range disconnectedSessions {
			total += sessionInfo.DisconnectTime.Sub(sessionInfo.StartTime)
		}
	}
	return total
}

func (stats *UsageStats) GetCountOfActiveSessions(ctx context.Context) int {
	stats.catchUp(ctx)
	return len(stats.sessionInfoByID)
}

func (stats *UsageStats) catchUp(ctx context.Context) {
	stats.mutex.Lock()
	defer stats.mutex.Unlock()
	iterator := stats.log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{
		FromCursor: stats.cursor,
	})
	for iterator.Next(ctx) {
		event := iterator.Event()
		stats.applyEvent(ctx, event)
		stats.cursor = event.LogicalClock
	}
}

func (stats *UsageStats) applyEvent(ctx context.Context, event *eventlog.Event) {
	apply, ok := statsApplyByType[event.Type]
	if !ok {
		return
	}
	apply(ctx, stats, event)
}

type statsApplyFunc func(ctx context.Context, stats *UsageStats, event *eventlog.Event)

var statsApplyByType = map[string]statsApplyFunc{
	EventTypeServerStarted:      applyServerStartedEvent,
	EventTypeSessionStarted:     applySessionStartedEvent,
	EventTypeSessionEnded:       applySessionEndedEvent,
	EventTypeClientConnected:    applyClientConnectedEvent,
	EventTypeClientDisconnected: applyClientDisconnectedEvent,
}

type SessionInfo struct {
	ID               string
	AccountID        string
	HostConnectionID string
	StartTime        time.Time
}

type DisconnectedSessionInfo struct {
	*SessionInfo
	DisconnectTime time.Time
}

func applySessionStartedEvent(ctx context.Context, stats *UsageStats, event *eventlog.Event) {
	var sessionStartedData StartSessionEventData
	err := json.Unmarshal(event.Data, &sessionStartedData)
	fatal.OnError(err)
	sessionInfo := SessionInfo{
		ID:               sessionStartedData.ID,
		AccountID:        event.AccountID,
		HostConnectionID: sessionStartedData.HostConnectionID,
		StartTime:        sessionStartedData.StartedAt,
	}
	if existingSessionInfo, ok := stats.sessionInfoByConnectionID[sessionStartedData.HostConnectionID]; ok {
		stats.removeActiveSession(existingSessionInfo)
	}
	stats.removeDisconnectedSessionByConnectionID(sessionStartedData.HostConnectionID)
	stats.sessionInfoByID[sessionStartedData.ID] = &sessionInfo
	stats.sessionInfoByConnectionID[sessionStartedData.HostConnectionID] = &sessionInfo
}

func applySessionEndedEvent(ctx context.Context, stats *UsageStats, event *eventlog.Event) {
	var sessionEndedData EndSessionEventData
	err := json.Unmarshal(event.Data, &sessionEndedData)
	fatal.OnError(err)
	sessionInfo, ok := stats.sessionInfoByID[sessionEndedData.ID]
	if ok {
		endTime := time.Unix(event.UnixTimestamp, 0)
		duration := endTime.Sub(sessionInfo.StartTime)
		stats.durationByAccountID[sessionInfo.AccountID] += duration
		stats.removeActiveSession(sessionInfo)
		return
	}
	disconnectedSession, ok := stats.removeDisconnectedSessionByID(event.AccountID, sessionEndedData.ID)
	if !ok {
		// log.Println("WARN: session ended without starting", sessionEndedData.ID)
		return
	}
	duration := disconnectedSession.DisconnectTime.Sub(disconnectedSession.StartTime)
	stats.durationByAccountID[disconnectedSession.AccountID] += duration
}

func applyClientConnectedEvent(ctx context.Context, stats *UsageStats, event *eventlog.Event) {
	var clientConnectedData ClientConnectedEventData
	err := json.Unmarshal(event.Data, &clientConnectedData)
	fatal.OnError(err)
	disconnectedSession, ok := stats.removeDisconnectedSessionByConnectionID(clientConnectedData.ConnectionID)
	if !ok {
		return
	}
	reconnectTime := time.Unix(event.UnixTimestamp, 0)
	disconnectedDuration := reconnectTime.Sub(disconnectedSession.DisconnectTime)
	if disconnectedDuration > 0 {
		disconnectedSession.StartTime = disconnectedSession.StartTime.Add(disconnectedDuration)
	}
	stats.sessionInfoByID[disconnectedSession.ID] = disconnectedSession.SessionInfo
	stats.sessionInfoByConnectionID[disconnectedSession.HostConnectionID] = disconnectedSession.SessionInfo
}

func applyClientDisconnectedEvent(ctx context.Context, stats *UsageStats, event *eventlog.Event) {
	var clientDisconnectedData ClientDisconnectedEventData
	err := json.Unmarshal(event.Data, &clientDisconnectedData)
	fatal.OnError(err)
	sessionInfo, ok := stats.sessionInfoByConnectionID[clientDisconnectedData.ConnectionID]
	if !ok {
		return
	}
	disconnectTime := time.Unix(event.UnixTimestamp, 0)
	if disconnectWasClean(clientDisconnectedData.WebSocketCloseCode) {
		duration := disconnectTime.Sub(sessionInfo.StartTime)
		stats.durationByAccountID[event.AccountID] += duration
		stats.removeActiveSession(sessionInfo)
		return
	}
	stats.trackDisconnectedSession(sessionInfo, disconnectTime)
}

func applyServerStartedEvent(ctx context.Context, stats *UsageStats, event *eventlog.Event) {
	disconnectTime := time.Unix(event.UnixTimestamp, 0)
	sessionInfos := make([]*SessionInfo, 0, len(stats.sessionInfoByConnectionID))
	for _, sessionInfo := range stats.sessionInfoByConnectionID {
		sessionInfos = append(sessionInfos, sessionInfo)
	}
	for _, sessionInfo := range sessionInfos {
		stats.trackDisconnectedSession(sessionInfo, disconnectTime)
	}
}

func (stats *UsageStats) trackDisconnectedSession(sessionInfo *SessionInfo, disconnectTime time.Time) {
	stats.removeActiveSession(sessionInfo)
	stats.removeDisconnectedSessionByConnectionID(sessionInfo.HostConnectionID)
	disconnectedSession := &DisconnectedSessionInfo{
		SessionInfo:    sessionInfo,
		DisconnectTime: disconnectTime,
	}
	disconnectedSessions := stats.disconnectedSessionsByAccountID[sessionInfo.AccountID]
	disconnectedSessions = append(disconnectedSessions, disconnectedSession)
	if len(disconnectedSessions) > maxDisconnectedSessionsPerAccount {
		evictedSession := disconnectedSessions[0]
		delete(stats.disconnectedSessionByConnectionID, evictedSession.HostConnectionID)
		disconnectedSessions = disconnectedSessions[1:]
	}
	stats.disconnectedSessionsByAccountID[sessionInfo.AccountID] = disconnectedSessions
	stats.disconnectedSessionByConnectionID[sessionInfo.HostConnectionID] = disconnectedSession
}

func (stats *UsageStats) removeActiveSession(sessionInfo *SessionInfo) {
	delete(stats.sessionInfoByID, sessionInfo.ID)
	delete(stats.sessionInfoByConnectionID, sessionInfo.HostConnectionID)
}

func (stats *UsageStats) removeDisconnectedSessionByConnectionID(connectionID string) (*DisconnectedSessionInfo, bool) {
	disconnectedSession, ok := stats.disconnectedSessionByConnectionID[connectionID]
	if !ok {
		return nil, false
	}
	delete(stats.disconnectedSessionByConnectionID, connectionID)
	disconnectedSessions := stats.disconnectedSessionsByAccountID[disconnectedSession.AccountID]
	for i, candidate := range disconnectedSessions {
		if candidate.HostConnectionID != connectionID {
			continue
		}
		disconnectedSessions = append(disconnectedSessions[:i], disconnectedSessions[i+1:]...)
		if len(disconnectedSessions) == 0 {
			delete(stats.disconnectedSessionsByAccountID, disconnectedSession.AccountID)
		} else {
			stats.disconnectedSessionsByAccountID[disconnectedSession.AccountID] = disconnectedSessions
		}
		return disconnectedSession, true
	}
	return disconnectedSession, true
}

func (stats *UsageStats) removeDisconnectedSessionByID(accountID string, sessionID string) (*DisconnectedSessionInfo, bool) {
	disconnectedSessions := stats.disconnectedSessionsByAccountID[accountID]
	for i, disconnectedSession := range disconnectedSessions {
		if disconnectedSession.ID != sessionID {
			continue
		}
		delete(stats.disconnectedSessionByConnectionID, disconnectedSession.HostConnectionID)
		disconnectedSessions = append(disconnectedSessions[:i], disconnectedSessions[i+1:]...)
		if len(disconnectedSessions) == 0 {
			delete(stats.disconnectedSessionsByAccountID, accountID)
		} else {
			stats.disconnectedSessionsByAccountID[accountID] = disconnectedSessions
		}
		return disconnectedSession, true
	}
	return nil, false
}

func disconnectWasClean(closeCode int) bool {
	switch closeCode {
	case 1000, 1001:
		return true
	default:
		return false
	}
}
