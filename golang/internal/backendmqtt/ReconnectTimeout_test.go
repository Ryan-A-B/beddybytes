package backendmqtt

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/connections"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	. "github.com/smartystreets/goconvey/convey"
)

func TestReconnectTimeoutScheduler(t *testing.T) {
	Convey("ReconnectTimeoutScheduler", t, func() {
		ctx := context.Background()
		folderPath, err := os.MkdirTemp("", "TestReconnectTimeoutScheduler-*")
		So(err, ShouldBeNil)
		log := eventlog.NewThreadSafeDecorator(&eventlog.NewThreadSafeDecoratorInput{
			Decorated: eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
				FolderPath: folderPath,
			}),
		})
		scheduler := NewReconnectTimeoutScheduler(NewReconnectTimeoutSchedulerInput{
			EventLog: log,
			Retain:   10 * time.Millisecond,
		})
		accountID := "account-1"
		clientID := "client-1"
		connectionID := "connection-1"
		requestID := "request-1"

		Convey("publishes reconnect timeout after the client has been offline for the retention period", func() {
			scheduler.Schedule(accountID, clientID, connectionID, requestID)

			event := waitForEvent(ctx, log, connections.EventTypeReconnectTimeout, 200*time.Millisecond)
			So(event, ShouldNotBeNil)
			So(event.AccountID, ShouldEqual, accountID)
			var data connections.EventReconnectTimeout
			err = json.Unmarshal(event.Data, &data)
			So(err, ShouldBeNil)
			So(data.ClientID, ShouldEqual, clientID)
			So(data.ConnectionID, ShouldEqual, connectionID)
			So(data.RequestID, ShouldEqual, requestID)
		})

		Convey("does not publish reconnect timeout after same-client activity cancels the timer", func() {
			scheduler.Schedule(accountID, clientID, connectionID, requestID)
			scheduler.CancelClient(accountID, clientID)

			event := waitForEvent(ctx, log, connections.EventTypeReconnectTimeout, 100*time.Millisecond)
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
