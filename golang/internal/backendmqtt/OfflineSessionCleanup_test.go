package backendmqtt

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	. "github.com/smartystreets/goconvey/convey"
)

func TestOfflineSessionCleanupScheduler(t *testing.T) {
	Convey("OfflineSessionCleanupScheduler", t, func() {
		ctx := context.Background()
		folderPath, err := os.MkdirTemp("", "TestOfflineSessionCleanupScheduler-*")
		So(err, ShouldBeNil)
		log := eventlog.NewThreadSafeDecorator(&eventlog.NewThreadSafeDecoratorInput{
			Decorated: eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
				FolderPath: folderPath,
			}),
		})
		scheduler := NewOfflineSessionCleanupScheduler(NewOfflineSessionCleanupSchedulerInput{
			EventLog: log,
			Retain:   10 * time.Millisecond,
		})
		accountID := "account-1"
		clientID := "client-1"
		connectionID := "connection-1"
		sessionID := "session-1"

		scheduler.TrackSession(accountID, SessionAnnouncement{
			ClientID:        clientID,
			ConnectionID:    connectionID,
			SessionID:       sessionID,
			Name:            "test",
			StartedAtMillis: time.Now().UnixMilli(),
		})

		Convey("removes a session after the client has been offline for the retention period", func() {
			scheduler.Schedule(accountID, clientID, connectionID)

			event := waitForEvent(ctx, log, EventTypeSessionRemoved, 200*time.Millisecond)
			So(event, ShouldNotBeNil)
			So(event.AccountID, ShouldEqual, accountID)
			var data RemoveSessionEventData
			err = json.Unmarshal(event.Data, &data)
			So(err, ShouldBeNil)
			So(data.ID, ShouldEqual, sessionID)
			So(data.Reason, ShouldEqual, RemoveSessionReasonCleanupAfterClientOffline)
		})

		Convey("does not remove a session after same-client activity cancels the timer", func() {
			scheduler.Schedule(accountID, clientID, connectionID)
			scheduler.CancelClient(accountID, clientID)

			event := waitForEvent(ctx, log, EventTypeSessionRemoved, 100*time.Millisecond)
			So(event, ShouldBeNil)
		})
	})
}

func waitForEvent(ctx context.Context, log eventlog.EventLog, eventType string, timeout time.Duration) *eventlog.Event {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
		for iterator.Next(ctx) {
			event := iterator.Event()
			if event.Type == eventType {
				return event
			}
		}
		if iterator.Err() != nil {
			panic(iterator.Err())
		}
		time.Sleep(time.Millisecond)
	}
	return nil
}
