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

	sessionInfoByID              map[string]*SessionInfo
	sessionInfoByConnectionID    map[string]*SessionInfo
	disconnectTimeByConnectionID map[string]time.Time
	durationByAccountID          map[string]time.Duration
}

type NewUsageStatsInput struct {
	Log eventlog.EventLog
}

func NewUsageStats(ctx context.Context, input NewUsageStatsInput) *UsageStats {
	return &UsageStats{
		log:                          input.Log,
		sessionInfoByID:              make(map[string]*SessionInfo),
		sessionInfoByConnectionID:    make(map[string]*SessionInfo),
		disconnectTimeByConnectionID: make(map[string]time.Time),
		durationByAccountID:          make(map[string]time.Duration),
	}
}

func (stats *UsageStats) GetTotalDuration(ctx context.Context) time.Duration {
	stats.catchUp(ctx)
	total := time.Duration(0)
	for _, duration := range stats.durationByAccountID {
		total += duration
	}
	for _, sessionInfo := range stats.sessionInfoByID {
		disconnectTime, ok := stats.disconnectTimeByConnectionID[sessionInfo.HostConnectionID]
		if ok {
			total += disconnectTime.Sub(sessionInfo.StartTime)
		} else {
			duration := time.Since(sessionInfo.StartTime)
			total += duration
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
	iterator := stats.log.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
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
		// log.Println("WARN: session started with same host connection ID as existing session", sessionStartedData.HostConnectionID)
		delete(stats.sessionInfoByID, existingSessionInfo.ID)
	}
	stats.sessionInfoByID[sessionStartedData.ID] = &sessionInfo
	stats.sessionInfoByConnectionID[sessionStartedData.HostConnectionID] = &sessionInfo
}

func applySessionEndedEvent(ctx context.Context, stats *UsageStats, event *eventlog.Event) {
	var sessionEndedData EndSessionEventData
	err := json.Unmarshal(event.Data, &sessionEndedData)
	fatal.OnError(err)
	sessionInfo, ok := stats.sessionInfoByID[sessionEndedData.ID]
	if !ok {
		// log.Println("WARN: session ended without starting", sessionEndedData.ID)
		return
	}
	endTime := time.Unix(event.UnixTimestamp, 0)
	duration := endTime.Sub(sessionInfo.StartTime)
	stats.durationByAccountID[sessionInfo.AccountID] += duration
	delete(stats.sessionInfoByID, sessionEndedData.ID)
	delete(stats.sessionInfoByConnectionID, sessionInfo.HostConnectionID)
	delete(stats.disconnectTimeByConnectionID, sessionInfo.HostConnectionID)
}

func applyClientConnectedEvent(ctx context.Context, stats *UsageStats, event *eventlog.Event) {
	var clientConnectedData ClientConnectedEventData
	err := json.Unmarshal(event.Data, &clientConnectedData)
	fatal.OnError(err)
	delete(stats.disconnectTimeByConnectionID, clientConnectedData.ConnectionID)
}

func applyClientDisconnectedEvent(ctx context.Context, stats *UsageStats, event *eventlog.Event) {
	var clientDisconnectedData ClientDisconnectedEventData
	err := json.Unmarshal(event.Data, &clientDisconnectedData)
	fatal.OnError(err)
	sessionInfo, ok := stats.sessionInfoByConnectionID[clientDisconnectedData.ConnectionID]
	if !ok {
		return
	}
	if _, ok := stats.disconnectTimeByConnectionID[clientDisconnectedData.ConnectionID]; ok {
		return
	}
	disconnectTime := time.Unix(event.UnixTimestamp, 0)
	if disconnectWasClean(clientDisconnectedData.WebSocketCloseCode) {
		duration := disconnectTime.Sub(sessionInfo.StartTime)
		stats.durationByAccountID[event.AccountID] += duration
		delete(stats.sessionInfoByID, sessionInfo.ID)
		delete(stats.sessionInfoByConnectionID, clientDisconnectedData.ConnectionID)
		return
	}
	stats.disconnectTimeByConnectionID[clientDisconnectedData.ConnectionID] = disconnectTime
}

func applyServerStartedEvent(ctx context.Context, stats *UsageStats, event *eventlog.Event) {
	disconnectTime := time.Unix(event.UnixTimestamp, 0)
	for connectionID := range stats.sessionInfoByConnectionID {
		if _, ok := stats.disconnectTimeByConnectionID[connectionID]; ok {
			continue
		}
		stats.disconnectTimeByConnectionID[connectionID] = disconnectTime
	}
}

func disconnectWasClean(closeCode int) bool {
	switch closeCode {
	case 1000, 1001:
		return true
	default:
		return false
	}
}
