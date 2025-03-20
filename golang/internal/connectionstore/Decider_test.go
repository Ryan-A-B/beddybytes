package connectionstore_test

import (
	"context"
	"os"
	"testing"

	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/beddybytes/golang/internal/connectionstore"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

func TestDecider(t *testing.T) {
	Convey("TestDecider", t, func() {
		ctx := context.Background()
		folderPath, err := os.MkdirTemp("testdata", "TestDecider-*")
		So(err, ShouldBeNil)
		eventLog := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
			FolderPath: folderPath,
		})
		decider := connectionstore.NewDecider(connectionstore.NewDeciderInput{
			EventLog: eventLog,
		})
		Convey("Empty", func() {
			connection := connectionstore.Connection{
				ID:        uuid.NewV4().String(),
				AccountID: uuid.NewV4().String(),
				ClientID:  uuid.NewV4().String(),
				RequestID: uuid.NewV4().String(),
			}
			Convey("Put", func() {
				err = decider.Put(ctx, connection)
				So(err, ShouldBeNil)
			})
			Convey("Delete", func() {
				err = decider.Delete(ctx, connection)
				So(err, ShouldBeNil)
			})
		})
		Convey("Single Connection", func() {
			connection := connectionstore.Connection{
				ID:        uuid.NewV4().String(),
				AccountID: uuid.NewV4().String(),
				ClientID:  uuid.NewV4().String(),
				RequestID: uuid.NewV4().String(),
			}
			err = decider.Put(ctx, connection)
			So(err, ShouldBeNil)
			Convey("Delete", func() {
				err = decider.Delete(ctx, connection)
				So(err, ShouldBeNil)
				Convey("Delete again", func() {
					err = decider.Delete(ctx, connection)
					So(err, ShouldEqual, connectionstore.ErrDuplicate)
				})
			})
		})
		Convey("Multiple Connections", func() {
			Convey("Multiple Accounts", func() {
				connections := []connectionstore.Connection{
					{
						ID:        uuid.NewV4().String(),
						AccountID: uuid.NewV4().String(),
						ClientID:  uuid.NewV4().String(),
						RequestID: uuid.NewV4().String(),
					},
					{
						ID:        uuid.NewV4().String(),
						AccountID: uuid.NewV4().String(),
						ClientID:  uuid.NewV4().String(),
						RequestID: uuid.NewV4().String(),
					},
				}
				for _, connection := range connections {
					err = decider.Put(ctx, connection)
					So(err, ShouldBeNil)
				}
				Convey("Delete", func() {
					err = decider.Delete(ctx, connections[0])
					So(err, ShouldBeNil)
					Convey("Delete again", func() {
						err = decider.Delete(ctx, connections[0])
						So(err, ShouldEqual, connectionstore.ErrDuplicate)
					})
				})
			})
		})
	})
}
