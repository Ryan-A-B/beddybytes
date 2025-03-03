package eventlog_test

import (
	"context"
	"encoding/json"
	"testing"

	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
)

type EventLogFactory interface {
	Create(ctx context.Context) eventlog.EventLog
}

func testEventLog(t *testing.T, factory EventLogFactory) {
	ctx := context.Background()
	Convey("append one", t, func() {
		eventLog := factory.Create(ctx)
		accountID := uuid.NewV4().String()
		data, err := json.Marshal(map[string]string{
			uuid.NewV4().String(): uuid.NewV4().String(),
		})
		So(err, ShouldBeNil)
		event, err := eventLog.Append(ctx, eventlog.AppendInput{
			Type:      "test",
			AccountID: accountID,
			Data:      data,
		})
		So(err, ShouldBeNil)
		So(event, ShouldNotBeNil)
		So(event.ID, ShouldNotBeEmpty)
		So(event.Type, ShouldEqual, "test")
		So(event.AccountID, ShouldEqual, accountID)
		So(event.LogicalClock, ShouldBeGreaterThan, 0)
		So(event.UnixTimestamp, ShouldNotEqual, 0)
		So(event.Data, ShouldResemble, json.RawMessage(data))
		Convey("iterate", func() {
			iterator := eventLog.GetEventIterator(ctx, eventlog.GetEventIteratorInput{
				FromCursor: event.LogicalClock - 1,
			})
			So(iterator, ShouldNotBeNil)
			So(iterator.Next(ctx), ShouldBeTrue)
			So(iterator.Event(), ShouldResemble, event)
			So(iterator.Next(ctx), ShouldBeFalse)
			So(iterator.Err(), ShouldBeNil)
		})
	})
	Convey("append many", t, func() {
		eventLog := factory.Create(ctx)
		events := make([]*eventlog.Event, 100)
		for i := 0; i < 100; i++ {
			data, err := json.Marshal(map[string]string{
				uuid.NewV4().String(): uuid.NewV4().String(),
			})
			So(err, ShouldBeNil)
			event, err := eventLog.Append(ctx, eventlog.AppendInput{
				Type: "test",
				Data: data,
			})
			So(err, ShouldBeNil)
			events[i] = event
		}
		Convey("iterate", func() {
			iterator := eventLog.GetEventIterator(ctx, eventlog.GetEventIteratorInput{
				FromCursor: events[0].LogicalClock - 1,
			})
			So(iterator, ShouldNotBeNil)
			for i := 0; i < 100; i++ {
				So(iterator.Next(ctx), ShouldBeTrue)
				event := iterator.Event()
				So(event, ShouldNotBeNil)
				So(event, ShouldResemble, events[i])
			}
			So(iterator.Next(ctx), ShouldBeFalse)
			So(iterator.Err(), ShouldBeNil)
		})
	})
	// Convey("append while iterating", t, func() {
	// 	eventLog := factory.Create(ctx)
	// 	iterator := eventLog.GetEventIterator(ctx, eventlog.GetEventIteratorInput{
	// 		FromCursor: 0,
	// 	})
	// 	n := 100
	// 	for i := 0; i < n; i++ {
	// 		data, err := json.Marshal(map[string]string{
	// 			uuid.NewV4().String(): uuid.NewV4().String(),
	// 		})
	// 		So(err, ShouldBeNil)
	// 		event, err := eventLog.Append(ctx, eventlog.AppendInput{
	// 			Type: "test",
	// 			Data: data,
	// 		})
	// 		So(err, ShouldBeNil)
	// 		So(iterator.Next(ctx), ShouldBeTrue)
	// 		So(iterator.Event(), ShouldResemble, event)
	// 	}
	// 	So(iterator.Next(ctx), ShouldBeFalse)
	// 	So(iterator.Err(), ShouldBeNil)
	// })
}

func benchmarkAppend(b *testing.B, factory EventLogFactory) {
	ctx := context.Background()
	eventLog := factory.Create(ctx)
	input := eventlog.AppendInput{
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

func benchmarkEventIterator(b *testing.B, factory EventLogFactory) {
	ctx := context.Background()
	var err error
	eventLog := factory.Create(ctx)
	for i := 0; i < 100; i++ {
		_, err = eventLog.Append(ctx, eventlog.AppendInput{
			Type: "test",
			Data: fatal.UnlessMarshalJSON(map[string]string{
				uuid.NewV4().String(): uuid.NewV4().String(),
			}),
		})
	}
	if err != nil {
		b.Fatal(err)
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		iterator := eventLog.GetEventIterator(ctx, eventlog.GetEventIteratorInput{
			FromCursor: 0,
		})
		for iterator.Next(ctx) {
		}
		err = iterator.Err()
		if err != nil {
			b.Fatal(err)
		}
	}
}
