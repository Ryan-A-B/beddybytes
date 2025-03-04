package eventlog_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"
)

func TestFollow(t *testing.T) {
	Convey("Follow", t, func() {
		folderPath, err := os.MkdirTemp("testdata", "TestFollow-*")
		So(err, ShouldBeNil)
		eventLog := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
			FolderPath: folderPath,
		})
		ctx := context.Background()
		accountID := uuid.NewV4().String()
		Convey("empty log", func() {
			ctx, cancel := context.WithCancel(ctx)
			iterator := eventlog.Follow(ctx, eventlog.FollowInput{
				EventLog:   eventLog,
				FromCursor: 0,
			})
			nextC := make(chan bool)
			go func() {
				nextC <- iterator.Next(ctx)
			}()
			select {
			case <-nextC:
				t.Fail()
			case <-time.After(100 * time.Millisecond):
			}
			Convey("cancel", func() {
				cancel()
				next := <-nextC
				So(next, ShouldBeFalse)
				So(iterator.Err(), ShouldBeNil)
			})
			Convey("append", func() {
				eventType := uuid.NewV4().String()
				data, err := json.Marshal(uuid.NewV4().String())
				So(err, ShouldBeNil)
				_, err = eventLog.Append(ctx, eventlog.AppendInput{
					Type:      eventType,
					AccountID: accountID,
					Data:      data,
				})
				So(err, ShouldBeNil)
				next := <-nextC
				So(next, ShouldBeTrue)
				event := iterator.Event()
				So(event.Type, ShouldEqual, eventType)
				So(event.AccountID, ShouldEqual, accountID)
				So(event.Data, ShouldResemble, json.RawMessage(data))
				So(event.LogicalClock, ShouldEqual, 1)
			})
		})
		Convey("one event", func() {
			eventType := uuid.NewV4().String()
			data, err := json.Marshal(uuid.NewV4().String())
			So(err, ShouldBeNil)
			_, err = eventLog.Append(ctx, eventlog.AppendInput{
				Type:      eventType,
				AccountID: accountID,
				Data:      data,
			})
			So(err, ShouldBeNil)
			Convey("read from start", func() {
				ctx, cancel := context.WithCancel(ctx)
				iterator := eventlog.Follow(ctx, eventlog.FollowInput{
					EventLog:   eventLog,
					FromCursor: 0,
				})
				nextC := make(chan bool)
				go func() {
					nextC <- iterator.Next(ctx)
				}()
				next := <-nextC
				So(next, ShouldBeTrue)
				event := iterator.Event()
				So(event.Type, ShouldEqual, eventType)
				So(event.AccountID, ShouldEqual, accountID)
				So(event.Data, ShouldResemble, json.RawMessage(data))
				So(event.LogicalClock, ShouldEqual, 1)
				go func() {
					nextC <- iterator.Next(ctx)
				}()
				select {
				case <-nextC:
					t.Fail()
				case <-time.After(100 * time.Millisecond):
				}
				Convey("cancel", func() {
					cancel()
					next := <-nextC
					So(next, ShouldBeFalse)
					So(iterator.Err(), ShouldBeNil)
				})
				Convey("append", func() {
					eventType := uuid.NewV4().String()
					data, err := json.Marshal(uuid.NewV4().String())
					So(err, ShouldBeNil)
					_, err = eventLog.Append(ctx, eventlog.AppendInput{
						Type:      eventType,
						AccountID: accountID,
						Data:      data,
					})
					So(err, ShouldBeNil)
					next := <-nextC
					So(next, ShouldBeTrue)
					event := iterator.Event()
					So(event.Type, ShouldEqual, eventType)
					So(event.AccountID, ShouldEqual, accountID)
					So(event.Data, ShouldResemble, json.RawMessage(data))
					So(event.LogicalClock, ShouldEqual, 2)
				})
			})
			Convey("tail", func() {
				ctx, cancel := context.WithCancel(ctx)
				iterator := eventlog.Follow(ctx, eventlog.FollowInput{
					EventLog:   eventLog,
					FromCursor: 1,
				})
				nextC := make(chan bool)
				go func() {
					nextC <- iterator.Next(ctx)
				}()
				select {
				case <-nextC:
					t.Fail()
				case <-time.After(100 * time.Millisecond):
				}
				Convey("cancel", func() {
					cancel()
					next := <-nextC
					So(next, ShouldBeFalse)
					So(iterator.Err(), ShouldBeNil)
				})
				Convey("append", func() {
					eventType := uuid.NewV4().String()
					data, err := json.Marshal(uuid.NewV4().String())
					So(err, ShouldBeNil)
					_, err = eventLog.Append(ctx, eventlog.AppendInput{
						Type:      eventType,
						AccountID: accountID,
						Data:      data,
					})
					So(err, ShouldBeNil)
					next := <-nextC
					So(next, ShouldBeTrue)
					event := iterator.Event()
					So(event.Type, ShouldEqual, eventType)
					So(event.AccountID, ShouldEqual, accountID)
					So(event.Data, ShouldResemble, json.RawMessage(data))
					So(event.LogicalClock, ShouldEqual, 2)
				})
			})
		})
	})
}
