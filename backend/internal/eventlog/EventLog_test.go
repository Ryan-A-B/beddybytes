package eventlog_test

import (
	"context"
	"encoding/json"
	"testing"

	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/baby-monitor/backend/internal/eventlog"
	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
)

type EventLogFactory interface {
	Create() eventlog.EventLog
}

func testEventLog(t *testing.T, factory EventLogFactory) {
	ctx := context.Background()
	Convey("append one", t, func() {
		eventLog := factory.Create()
		data, err := json.Marshal(map[string]string{
			uuid.NewV4().String(): uuid.NewV4().String(),
		})
		So(err, ShouldBeNil)
		event, err := eventLog.Append(ctx, &eventlog.AppendInput{
			Type: "test",
			Data: data,
		})
		So(err, ShouldBeNil)
		So(event, ShouldNotBeNil)
		So(event.ID, ShouldNotBeEmpty)
		So(event.Type, ShouldEqual, "test")
		So(event.LogicalClock, ShouldBeGreaterThan, 0)
		So(event.UnixTimestamp, ShouldNotEqual, 0)
		So(event.Data, ShouldResemble, json.RawMessage(data))
		Convey("iterate", func() {
			iterator := eventLog.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
				Cursor: event.LogicalClock - 1,
			})
			So(iterator, ShouldNotBeNil)
			So(iterator.Next(), ShouldBeTrue)
			So(iterator.Event(), ShouldResemble, event)
			So(iterator.Next(), ShouldBeFalse)
			So(iterator.Err(), ShouldBeNil)
		})
	})
	Convey("append many", t, func() {
		eventLog := factory.Create()
		events := make([]*eventlog.Event, 100)
		for i := 0; i < 100; i++ {
			data, err := json.Marshal(map[string]string{
				uuid.NewV4().String(): uuid.NewV4().String(),
			})
			So(err, ShouldBeNil)
			event, err := eventLog.Append(ctx, &eventlog.AppendInput{
				Type: "test",
				Data: data,
			})
			So(err, ShouldBeNil)
			events[i] = event
		}
		Convey("iterate", func() {
			iterator := eventLog.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
				Cursor: events[0].LogicalClock - 1,
			})
			So(iterator, ShouldNotBeNil)
			for i := 0; i < 100; i++ {
				So(iterator.Next(), ShouldBeTrue)
				event := iterator.Event()
				So(event, ShouldNotBeNil)
				So(event, ShouldResemble, events[i])
			}
			So(iterator.Next(), ShouldBeFalse)
			So(iterator.Err(), ShouldBeNil)
		})
	})
	Convey("append while iterating", t, func() {
		eventLog := factory.Create()
		iterator := eventLog.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
			Cursor: 0,
		})
		n := 100
		for i := 0; i < n; i++ {
			data, err := json.Marshal(map[string]string{
				uuid.NewV4().String(): uuid.NewV4().String(),
			})
			So(err, ShouldBeNil)
			event, err := eventLog.Append(ctx, &eventlog.AppendInput{
				Type: "test",
				Data: data,
			})
			So(err, ShouldBeNil)
			So(iterator.Next(), ShouldBeTrue)
			So(iterator.Event(), ShouldResemble, event)
		}
		So(iterator.Next(), ShouldBeFalse)
		So(iterator.Err(), ShouldBeNil)
	})
}

func benchmarkEventLog(b *testing.B, factory EventLogFactory) {
	ctx := context.Background()
	eventLog := factory.Create()
	input := &eventlog.AppendInput{
		Type: uuid.NewV4().String(),
		Data: fatal.UnlessMarshalJSON(map[string]string{
			uuid.NewV4().String(): uuid.NewV4().String(),
		}),
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := eventLog.Append(ctx, input)
		if err != nil {
			b.Fatal(err)
		}
	}
}
