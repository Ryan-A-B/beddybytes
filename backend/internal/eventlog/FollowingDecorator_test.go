package eventlog_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/baby-monitor/backend/internal/eventlog"
)

func TestFollowingDecorator(t *testing.T) {
	Convey("TestFollowingDecorator", t, func() {
		ctx := context.Background()
		folderPath, err := os.MkdirTemp("testdata", "TestFollowingDecorator-*")
		So(err, ShouldBeNil)
		eventLog := eventlog.NewFollowingDecorator(&eventlog.NewFollowingDecoratorInput{
			Decorated: eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
				FolderPath: folderPath,
			}),
			BufferSize: 128,
		})
		Convey("append one", func() {
			Convey("before iterator created", func() {
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
				So(event.LogicalClock, ShouldEqual, 1)
				So(event.UnixTimestamp, ShouldBeGreaterThan, 0)
				So(event.Data, ShouldResemble, json.RawMessage(data))
				iterator := eventLog.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
					FromCursor: 0,
				})
				So(iterator.Next(), ShouldBeTrue)
				So(iterator.Event(), ShouldResemble, event)
			})
			Convey("after iterator created", func() {
				iterator := eventLog.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
					FromCursor: 0,
				})
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
				So(event.LogicalClock, ShouldEqual, 1)
				So(event.UnixTimestamp, ShouldBeGreaterThan, 0)
				So(event.Data, ShouldResemble, json.RawMessage(data))
				So(iterator.Next(), ShouldBeTrue)
				So(iterator.Event(), ShouldResemble, event)
			})
		})
		Convey("append many", func() {
			Convey("before iterator created", func() {
				nEvents := 100
				events := make([]*eventlog.Event, nEvents)
				for i := 0; i < nEvents; i++ {
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
				iterator := eventLog.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
					FromCursor: 0,
				})
				for i := 0; i < nEvents; i++ {
					So(iterator.Next(), ShouldBeTrue)
					So(iterator.Event(), ShouldResemble, events[i])
				}
			})
			Convey("after iterator created", func() {
				iterator := eventLog.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
					FromCursor: 0,
				})
				nEvents := 100
				events := make([]*eventlog.Event, nEvents)
				for i := 0; i < nEvents; i++ {
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
				for i := 0; i < nEvents; i++ {
					So(iterator.Next(), ShouldBeTrue)
					So(iterator.Event(), ShouldResemble, events[i])
				}
			})
			Convey("iterater created after some events appended", func() {
				nEvents := 100
				events := make([]*eventlog.Event, nEvents)
				firstBatchSize := 50
				for i := 0; i < firstBatchSize; i++ {
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
				iterator := eventLog.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
					FromCursor: 0,
				})
				for i := firstBatchSize; i < nEvents; i++ {
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
				for i := 0; i < nEvents; i++ {
					So(iterator.Next(), ShouldBeTrue)
					So(iterator.Event(), ShouldResemble, events[i])
				}
			})
		})
	})
}
