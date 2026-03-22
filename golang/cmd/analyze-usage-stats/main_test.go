package main

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/cmd/analyze-usage-stats/internal/fullstate"
	"github.com/Ryan-A-B/beddybytes/golang/cmd/analyze-usage-stats/internal/lowmemory"
	"github.com/Ryan-A-B/beddybytes/golang/cmd/analyze-usage-stats/internal/shared"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	. "github.com/smartystreets/goconvey/convey"
)

func TestLowMemoryMatchesFullStateSessionLifetimeSemantics(t *testing.T) {
	Convey("Low-memory replay includes reconnect and post-disconnect offline gaps", t, func() {
		accountID := "account-1"
		sessionID := "session-1"
		connectionID := "connection-1"
		baseTime := time.Unix(1_700_000_000, 0).UTC()

		events := []*eventlog.Event{
			analyzerEvent(accountID, shared.EventTypeSessionStarted, baseTime, shared.StartSessionEventData{
				ID:               sessionID,
				Name:             "test",
				HostConnectionID: connectionID,
				StartedAt:        baseTime,
			}),
			analyzerEvent(accountID, shared.EventTypeClientDisconnected, baseTime.Add(time.Hour), shared.ClientDisconnectedEventData{
				ClientID:           "client-1",
				ConnectionID:       connectionID,
				RequestID:          "request-1",
				WebSocketCloseCode: 1006,
			}),
			analyzerEvent(accountID, shared.EventTypeClientConnected, baseTime.Add(3*time.Hour), shared.ClientConnectedEventData{
				ClientID:     "client-1",
				ConnectionID: connectionID,
				RequestID:    "request-2",
			}),
			analyzerEvent(accountID, shared.EventTypeClientDisconnected, baseTime.Add(5*time.Hour), shared.ClientDisconnectedEventData{
				ClientID:           "client-1",
				ConnectionID:       connectionID,
				RequestID:          "request-3",
				WebSocketCloseCode: 1006,
			}),
			analyzerEvent(accountID, shared.EventTypeSessionEnded, baseTime.Add(8*time.Hour), shared.EndSessionEventData{
				ID: sessionID,
			}),
		}

		fullStateStats := fullstate.New()
		lowMemoryStats := lowmemory.New(4)
		for _, event := range events {
			fullStateStats.Apply(event)
			lowMemoryStats.Apply(event)
		}

		referenceTime := baseTime.Add(9 * time.Hour)
		So(fullStateStats.TotalDuration(referenceTime), ShouldEqual, 8*time.Hour)
		So(lowMemoryStats.TotalDuration(referenceTime), ShouldEqual, 8*time.Hour)
		So(fullStateStats.EndedWhileDisconnectedGap, ShouldEqual, 3*time.Hour)
		So(lowMemoryStats.EndedWhileDisconnectedGap, ShouldEqual, 3*time.Hour)
		So(fullStateStats.TotalDuration(referenceTime)-lowMemoryStats.TotalDuration(referenceTime), ShouldEqual, 0)
	})
}

func analyzerEvent(accountID string, eventType string, eventTime time.Time, data interface{}) *eventlog.Event {
	rawData, err := json.Marshal(data)
	if err != nil {
		panic(err)
	}
	return &eventlog.Event{
		Type:          eventType,
		AccountID:     accountID,
		UnixTimestamp: eventTime.Unix(),
		Data:          rawData,
	}
}
