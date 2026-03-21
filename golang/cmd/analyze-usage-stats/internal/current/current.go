package current

import (
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/cmd/analyze-usage-stats/internal/shared"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

type Stats struct {
	CacheSize int

	SessionInfoByID                   map[string]*shared.SessionInfo
	SessionInfoByConnectionID         map[string]*shared.SessionInfo
	DisconnectedSessionByConnectionID map[string]*shared.DisconnectedSessionInfo
	DisconnectedSessionsByAccountID   map[string][]*shared.DisconnectedSessionInfo
	EvictedSessionByConnectionID      map[string]*shared.DisconnectedSessionInfo
	DurationByAccountID               map[string]time.Duration
	ReconnectCount                    int
	ReconnectGapDuration              time.Duration
	MissedReconnectCount              int
	MissedReconnectGap                time.Duration
	EvictedCount                      int
	EvictedDuration                   time.Duration
}

func New(cacheSize int) *Stats {
	return &Stats{
		CacheSize:                         cacheSize,
		SessionInfoByID:                   make(map[string]*shared.SessionInfo),
		SessionInfoByConnectionID:         make(map[string]*shared.SessionInfo),
		DisconnectedSessionByConnectionID: make(map[string]*shared.DisconnectedSessionInfo),
		DisconnectedSessionsByAccountID:   make(map[string][]*shared.DisconnectedSessionInfo),
		EvictedSessionByConnectionID:      make(map[string]*shared.DisconnectedSessionInfo),
		DurationByAccountID:               make(map[string]time.Duration),
	}
}

func (stats *Stats) Apply(event *eventlog.Event) {
	switch event.Type {
	case shared.EventTypeServerStarted:
		disconnectTime := shared.EventTime(event)
		sessionInfos := make([]*shared.SessionInfo, 0, len(stats.SessionInfoByConnectionID))
		for _, session := range stats.SessionInfoByConnectionID {
			sessionInfos = append(sessionInfos, session)
		}
		for _, session := range sessionInfos {
			stats.trackDisconnectedSession(session, disconnectTime)
		}
	case shared.EventTypeSessionStarted:
		var data shared.StartSessionEventData
		shared.MustUnmarshal(event.Data, &data)
		session := &shared.SessionInfo{
			ID:               data.ID,
			AccountID:        event.AccountID,
			HostConnectionID: data.HostConnectionID,
			StartTime:        data.StartedAt,
		}
		if existingSession, ok := stats.SessionInfoByConnectionID[data.HostConnectionID]; ok {
			stats.removeActiveSession(existingSession)
		}
		stats.removeDisconnectedSessionByConnectionID(data.HostConnectionID)
		delete(stats.EvictedSessionByConnectionID, data.HostConnectionID)
		stats.SessionInfoByID[data.ID] = session
		stats.SessionInfoByConnectionID[data.HostConnectionID] = session
	case shared.EventTypeSessionEnded:
		var data shared.EndSessionEventData
		shared.MustUnmarshal(event.Data, &data)
		session, ok := stats.SessionInfoByID[data.ID]
		if ok {
			stats.DurationByAccountID[session.AccountID] += shared.EventTime(event).Sub(session.StartTime)
			stats.removeActiveSession(session)
			return
		}
		disconnectedSession, ok := stats.removeDisconnectedSessionByID(event.AccountID, data.ID)
		if !ok {
			return
		}
		stats.DurationByAccountID[disconnectedSession.AccountID] += disconnectedSession.DisconnectTime.Sub(disconnectedSession.StartTime)
	case shared.EventTypeClientConnected:
		var data shared.ClientConnectedEventData
		shared.MustUnmarshal(event.Data, &data)
		reconnectTime := shared.EventTime(event)
		disconnectedSession, ok := stats.removeDisconnectedSessionByConnectionID(data.ConnectionID)
		if ok {
			stats.ReconnectCount++
			stats.ReconnectGapDuration += reconnectTime.Sub(disconnectedSession.DisconnectTime)
			disconnectedDuration := reconnectTime.Sub(disconnectedSession.DisconnectTime)
			if disconnectedDuration > 0 {
				disconnectedSession.StartTime = disconnectedSession.StartTime.Add(disconnectedDuration)
			}
			stats.SessionInfoByID[disconnectedSession.ID] = disconnectedSession.SessionInfo
			stats.SessionInfoByConnectionID[disconnectedSession.HostConnectionID] = disconnectedSession.SessionInfo
			return
		}
		if evictedSession, ok := stats.EvictedSessionByConnectionID[data.ConnectionID]; ok {
			stats.MissedReconnectCount++
			stats.MissedReconnectGap += reconnectTime.Sub(evictedSession.DisconnectTime)
			delete(stats.EvictedSessionByConnectionID, data.ConnectionID)
		}
	case shared.EventTypeClientDisconnected:
		var data shared.ClientDisconnectedEventData
		shared.MustUnmarshal(event.Data, &data)
		session, ok := stats.SessionInfoByConnectionID[data.ConnectionID]
		if !ok {
			return
		}
		disconnectTime := shared.EventTime(event)
		if shared.DisconnectWasClean(data.WebSocketCloseCode) {
			stats.DurationByAccountID[event.AccountID] += disconnectTime.Sub(session.StartTime)
			stats.removeActiveSession(session)
			return
		}
		stats.trackDisconnectedSession(session, disconnectTime)
	}
}

func (stats *Stats) TotalDuration(referenceTime time.Time) time.Duration {
	total := time.Duration(0)
	for _, duration := range stats.DurationByAccountID {
		total += duration
	}
	for _, session := range stats.SessionInfoByID {
		total += referenceTime.Sub(session.StartTime)
	}
	for _, disconnectedSessions := range stats.DisconnectedSessionsByAccountID {
		for _, session := range disconnectedSessions {
			total += session.DisconnectTime.Sub(session.StartTime)
		}
	}
	return total
}

func (stats *Stats) FinalDisconnectedCount() int {
	count := 0
	for _, disconnectedSessions := range stats.DisconnectedSessionsByAccountID {
		count += len(disconnectedSessions)
	}
	return count
}

func (stats *Stats) trackDisconnectedSession(session *shared.SessionInfo, disconnectTime time.Time) {
	stats.removeActiveSession(session)
	stats.removeDisconnectedSessionByConnectionID(session.HostConnectionID)
	disconnectedSession := &shared.DisconnectedSessionInfo{
		SessionInfo:    session,
		DisconnectTime: disconnectTime,
	}
	disconnectedSessions := stats.DisconnectedSessionsByAccountID[session.AccountID]
	disconnectedSessions = append(disconnectedSessions, disconnectedSession)
	if len(disconnectedSessions) > stats.CacheSize {
		evictedSession := disconnectedSessions[0]
		evictedDuration := evictedSession.DisconnectTime.Sub(evictedSession.StartTime)
		stats.DurationByAccountID[evictedSession.AccountID] += evictedDuration
		stats.EvictedCount++
		stats.EvictedDuration += evictedDuration
		stats.EvictedSessionByConnectionID[evictedSession.HostConnectionID] = evictedSession
		delete(stats.DisconnectedSessionByConnectionID, evictedSession.HostConnectionID)
		disconnectedSessions = disconnectedSessions[1:]
	}
	stats.DisconnectedSessionsByAccountID[session.AccountID] = disconnectedSessions
	stats.DisconnectedSessionByConnectionID[session.HostConnectionID] = disconnectedSession
}

func (stats *Stats) removeActiveSession(session *shared.SessionInfo) {
	delete(stats.SessionInfoByID, session.ID)
	delete(stats.SessionInfoByConnectionID, session.HostConnectionID)
}

func (stats *Stats) removeDisconnectedSessionByConnectionID(connectionID string) (*shared.DisconnectedSessionInfo, bool) {
	disconnectedSession, ok := stats.DisconnectedSessionByConnectionID[connectionID]
	if !ok {
		return nil, false
	}
	delete(stats.DisconnectedSessionByConnectionID, connectionID)
	disconnectedSessions := stats.DisconnectedSessionsByAccountID[disconnectedSession.AccountID]
	for i, candidate := range disconnectedSessions {
		if candidate.HostConnectionID != connectionID {
			continue
		}
		disconnectedSessions = append(disconnectedSessions[:i], disconnectedSessions[i+1:]...)
		if len(disconnectedSessions) == 0 {
			delete(stats.DisconnectedSessionsByAccountID, disconnectedSession.AccountID)
		} else {
			stats.DisconnectedSessionsByAccountID[disconnectedSession.AccountID] = disconnectedSessions
		}
		return disconnectedSession, true
	}
	return disconnectedSession, true
}

func (stats *Stats) removeDisconnectedSessionByID(accountID string, sessionID string) (*shared.DisconnectedSessionInfo, bool) {
	disconnectedSessions := stats.DisconnectedSessionsByAccountID[accountID]
	for i, disconnectedSession := range disconnectedSessions {
		if disconnectedSession.ID != sessionID {
			continue
		}
		delete(stats.DisconnectedSessionByConnectionID, disconnectedSession.HostConnectionID)
		disconnectedSessions = append(disconnectedSessions[:i], disconnectedSessions[i+1:]...)
		if len(disconnectedSessions) == 0 {
			delete(stats.DisconnectedSessionsByAccountID, accountID)
		} else {
			stats.DisconnectedSessionsByAccountID[accountID] = disconnectedSessions
		}
		return disconnectedSession, true
	}
	return nil, false
}
