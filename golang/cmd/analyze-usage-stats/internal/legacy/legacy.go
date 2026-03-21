package legacy

import (
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/cmd/analyze-usage-stats/internal/shared"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

type Stats struct {
	SessionInfoByID              map[string]*shared.SessionInfo
	SessionInfoByConnectionID    map[string]*shared.SessionInfo
	DisconnectTimeByConnectionID map[string]time.Time
	DurationByAccountID          map[string]time.Duration
}

func New() *Stats {
	return &Stats{
		SessionInfoByID:              make(map[string]*shared.SessionInfo),
		SessionInfoByConnectionID:    make(map[string]*shared.SessionInfo),
		DisconnectTimeByConnectionID: make(map[string]time.Time),
		DurationByAccountID:          make(map[string]time.Duration),
	}
}

func (stats *Stats) Apply(event *eventlog.Event) {
	switch event.Type {
	case shared.EventTypeServerStarted:
		disconnectTime := shared.EventTime(event)
		for connectionID := range stats.SessionInfoByConnectionID {
			if _, ok := stats.DisconnectTimeByConnectionID[connectionID]; ok {
				continue
			}
			stats.DisconnectTimeByConnectionID[connectionID] = disconnectTime
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
			delete(stats.SessionInfoByID, existingSession.ID)
		}
		stats.SessionInfoByID[data.ID] = session
		stats.SessionInfoByConnectionID[data.HostConnectionID] = session
	case shared.EventTypeSessionEnded:
		var data shared.EndSessionEventData
		shared.MustUnmarshal(event.Data, &data)
		session, ok := stats.SessionInfoByID[data.ID]
		if !ok {
			return
		}
		stats.DurationByAccountID[session.AccountID] += shared.EventTime(event).Sub(session.StartTime)
		delete(stats.SessionInfoByID, data.ID)
		delete(stats.SessionInfoByConnectionID, session.HostConnectionID)
		delete(stats.DisconnectTimeByConnectionID, session.HostConnectionID)
	case shared.EventTypeClientConnected:
		var data shared.ClientConnectedEventData
		shared.MustUnmarshal(event.Data, &data)
		delete(stats.DisconnectTimeByConnectionID, data.ConnectionID)
	case shared.EventTypeClientDisconnected:
		var data shared.ClientDisconnectedEventData
		shared.MustUnmarshal(event.Data, &data)
		session, ok := stats.SessionInfoByConnectionID[data.ConnectionID]
		if !ok {
			return
		}
		if _, ok := stats.DisconnectTimeByConnectionID[data.ConnectionID]; ok {
			return
		}
		disconnectTime := shared.EventTime(event)
		if shared.DisconnectWasClean(data.WebSocketCloseCode) {
			stats.DurationByAccountID[event.AccountID] += disconnectTime.Sub(session.StartTime)
			delete(stats.SessionInfoByID, session.ID)
			delete(stats.SessionInfoByConnectionID, data.ConnectionID)
			return
		}
		stats.DisconnectTimeByConnectionID[data.ConnectionID] = disconnectTime
	}
}

func (stats *Stats) TotalDuration(referenceTime time.Time) time.Duration {
	total := time.Duration(0)
	for _, duration := range stats.DurationByAccountID {
		total += duration
	}
	for _, session := range stats.SessionInfoByID {
		if disconnectTime, ok := stats.DisconnectTimeByConnectionID[session.HostConnectionID]; ok {
			total += disconnectTime.Sub(session.StartTime)
			continue
		}
		total += referenceTime.Sub(session.StartTime)
	}
	return total
}
