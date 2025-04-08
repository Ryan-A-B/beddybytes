package babystationlist_test

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/babystationlist"
	"github.com/Ryan-A-B/beddybytes/golang/internal/connections"
	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"
)

func TestBabyStationList(t *testing.T) {
	Convey("TestBabyStationList", t, func() {
		ctx := context.Background()
		accountID := uuid.NewV4().String()
		ctx = contextx.WithAccountID(ctx, accountID)
		folderPath, err := os.MkdirTemp("testdata", "TestBabyStationList-*")
		So(err, ShouldBeNil)
		eventLog := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
			FolderPath: folderPath,
		})
		babyStationList := babystationlist.New(babystationlist.NewInput{
			EventLog: eventLog,
		})
		Convey("No events should return no baby stations", func() {
			output, err := babyStationList.GetSnapshot(ctx)
			So(err, ShouldBeNil)
			So(output.Snapshot.List(), ShouldHaveLength, 0)
			So(output.Cursor, ShouldEqual, 0)
		})
		Convey("Starting a session isn't enough for a baby station to show", func() {
			clientID := uuid.NewV4().String()
			connectionID := uuid.NewV4().String()
			sessionName := "Test Session"
			sessionStartedAt := time.Now()
			session := babystationlist.StartSessionEventData{
				ID:               uuid.NewV4().String(),
				Name:             sessionName,
				HostConnectionID: connectionID,
				StartedAt:        sessionStartedAt,
			}
			_, err = eventLog.Append(ctx, eventlog.AppendInput{
				Type:      babystationlist.EventTypeSessionStarted,
				AccountID: accountID,
				Data:      fatal.UnlessMarshalJSON(session),
			})
			So(err, ShouldBeNil)
			output, err := babyStationList.GetSnapshot(ctx)
			So(err, ShouldBeNil)
			So(output.Snapshot.SessionByID, ShouldHaveLength, 1)
			So(output.Snapshot.SessionIDByConnectionID, ShouldHaveLength, 1)
			So(output.Snapshot.ConnectionByID, ShouldHaveLength, 0)
			So(output.Snapshot.List(), ShouldHaveLength, 0)
			So(output.Cursor, ShouldEqual, 1)
			Convey("Once the client connects the baby station should be listed", func() {
				_, err = eventLog.Append(ctx, eventlog.AppendInput{
					Type:      connections.EventTypeConnected,
					AccountID: accountID,
					Data: fatal.UnlessMarshalJSON(connections.EventConnected{
						ClientID:     clientID,
						ConnectionID: connectionID,
						RequestID:    uuid.NewV4().String(),
					}),
				})
				So(err, ShouldBeNil)
				output, err := babyStationList.GetSnapshot(ctx)
				So(err, ShouldBeNil)
				So(output.Snapshot.SessionByID, ShouldHaveLength, 1)
				So(output.Snapshot.SessionIDByConnectionID, ShouldHaveLength, 1)
				So(output.Snapshot.ConnectionByID, ShouldHaveLength, 1)
				So(output.Snapshot.List(), ShouldHaveLength, 1)
				So(output.Cursor, ShouldEqual, 2)
				babyStation := output.Snapshot.List()[0]
				So(babyStation.Name, ShouldEqual, sessionName)
				So(babyStation.Connection.ID, ShouldEqual, connectionID)
				So(babyStation.StartedAt, ShouldHappenWithin, time.Millisecond, sessionStartedAt)
				Convey("When the client disconnects the baby station should no longer be listed", func() {
					_, err = eventLog.Append(ctx, eventlog.AppendInput{
						Type:      connections.EventTypeDisconnected,
						AccountID: accountID,
						Data: fatal.UnlessMarshalJSON(connections.EventDisconnected{
							ClientID:     clientID,
							ConnectionID: connectionID,
						}),
					})
					So(err, ShouldBeNil)
					output, err = babyStationList.GetSnapshot(ctx)
					So(err, ShouldBeNil)
					So(output.Snapshot.SessionByID, ShouldHaveLength, 1)
					So(output.Snapshot.SessionIDByConnectionID, ShouldHaveLength, 1)
					So(output.Snapshot.ConnectionByID, ShouldHaveLength, 0)
					So(output.Snapshot.List(), ShouldHaveLength, 0)
					So(output.Cursor, ShouldEqual, 3)
					Convey("When the client reconnects the baby station should be listed again", func() {
						_, err = eventLog.Append(ctx, eventlog.AppendInput{
							Type:      connections.EventTypeConnected,
							AccountID: accountID,
							Data: fatal.UnlessMarshalJSON(connections.EventConnected{
								ClientID:     clientID,
								ConnectionID: connectionID,
								RequestID:    uuid.NewV4().String(),
							}),
						})
						So(err, ShouldBeNil)
						output, err = babyStationList.GetSnapshot(ctx)
						So(err, ShouldBeNil)
						So(output.Snapshot.SessionByID, ShouldHaveLength, 1)
						So(output.Snapshot.SessionIDByConnectionID, ShouldHaveLength, 1)
						So(output.Snapshot.ConnectionByID, ShouldHaveLength, 1)
						So(output.Snapshot.List(), ShouldHaveLength, 1)
						So(output.Cursor, ShouldEqual, 4)
						babyStation := output.Snapshot.List()[0]
						So(babyStation.Name, ShouldEqual, sessionName)
						So(babyStation.Connection.ID, ShouldEqual, connectionID)
						So(babyStation.StartedAt, ShouldHappenWithin, time.Millisecond, sessionStartedAt)
					})
				})
				Convey("When the server restarts the baby station list should be empty", func() {
					_, err = eventLog.Append(ctx, eventlog.AppendInput{
						Type:      babystationlist.EventTypeServerStarted,
						AccountID: accountID,
						Data:      nil,
					})
					So(err, ShouldBeNil)
					output, err = babyStationList.GetSnapshot(ctx)
					So(err, ShouldBeNil)
					So(output.Snapshot.SessionByID, ShouldHaveLength, 1)
					So(output.Snapshot.SessionIDByConnectionID, ShouldHaveLength, 1)
					So(output.Snapshot.ConnectionByID, ShouldHaveLength, 0)
					So(output.Snapshot.List(), ShouldHaveLength, 0)
					So(output.Cursor, ShouldEqual, 3)
					Convey("When the client reconnects, the session should be listed again", func() {
						_, err = eventLog.Append(ctx, eventlog.AppendInput{
							Type:      connections.EventTypeConnected,
							AccountID: accountID,
							Data: fatal.UnlessMarshalJSON(connections.EventConnected{
								ClientID:     clientID,
								ConnectionID: connectionID,
								RequestID:    uuid.NewV4().String(),
							}),
						})
						So(err, ShouldBeNil)
						output, err = babyStationList.GetSnapshot(ctx)
						So(err, ShouldBeNil)
						So(output.Snapshot.SessionByID, ShouldHaveLength, 1)
						So(output.Snapshot.SessionIDByConnectionID, ShouldHaveLength, 1)
						So(output.Snapshot.ConnectionByID, ShouldHaveLength, 1)
						So(output.Snapshot.List(), ShouldHaveLength, 1)
						So(output.Cursor, ShouldEqual, 4)
						babyStation := output.Snapshot.List()[0]
						So(babyStation.Name, ShouldEqual, sessionName)
						So(babyStation.Connection.ID, ShouldEqual, connectionID)
						So(babyStation.StartedAt, ShouldHappenWithin, time.Millisecond, sessionStartedAt)
					})
				})
				Convey("Baby station should not be listed for another account", func() {
					otherAccountID := uuid.NewV4().String()
					otherSessionList := babystationlist.New(babystationlist.NewInput{
						EventLog: eventLog,
					})
					otherCtx := contextx.WithAccountID(ctx, otherAccountID)
					output, err = otherSessionList.GetSnapshot(otherCtx)
					So(err, ShouldBeNil)
					So(output.Snapshot.SessionByID, ShouldHaveLength, 0)
					So(output.Snapshot.SessionIDByConnectionID, ShouldHaveLength, 0)
					So(output.Snapshot.ConnectionByID, ShouldHaveLength, 0)
					So(output.Snapshot.List(), ShouldHaveLength, 0)
					So(output.Cursor, ShouldEqual, 2)
				})
			})
		})

		Convey("Two concurrent sessions should be handled correctly", func() {
			clientID1 := uuid.NewV4().String()
			connectionID1 := uuid.NewV4().String()
			sessionName1 := "Test Session 1"
			sessionStartedAt1 := time.Now()
			session1 := babystationlist.StartSessionEventData{
				ID:               uuid.NewV4().String(),
				Name:             sessionName1,
				HostConnectionID: connectionID1,
				StartedAt:        sessionStartedAt1,
			}
			_, err := eventLog.Append(ctx, eventlog.AppendInput{
				Type:      babystationlist.EventTypeSessionStarted,
				AccountID: accountID,
				Data:      fatal.UnlessMarshalJSON(session1),
			})
			So(err, ShouldBeNil)

			clientID2 := uuid.NewV4().String()
			connectionID2 := uuid.NewV4().String()
			sessionID2 := uuid.NewV4().String()
			sessionName2 := "Test Session 2"
			sessionStartedAt2 := time.Now()
			session2 := babystationlist.StartSessionEventData{
				ID:               sessionID2,
				Name:             sessionName2,
				HostConnectionID: connectionID2,
				StartedAt:        sessionStartedAt2,
			}
			_, err = eventLog.Append(ctx, eventlog.AppendInput{
				Type:      babystationlist.EventTypeSessionStarted,
				AccountID: accountID,
				Data:      fatal.UnlessMarshalJSON(session2),
			})
			So(err, ShouldBeNil)

			_, err = eventLog.Append(ctx, eventlog.AppendInput{
				Type:      connections.EventTypeConnected,
				AccountID: accountID,
				Data: fatal.UnlessMarshalJSON(connections.EventConnected{
					ClientID:     clientID1,
					ConnectionID: connectionID1,
					RequestID:    uuid.NewV4().String(),
				}),
			})
			So(err, ShouldBeNil)

			_, err = eventLog.Append(ctx, eventlog.AppendInput{
				Type:      connections.EventTypeConnected,
				AccountID: accountID,
				Data: fatal.UnlessMarshalJSON(connections.EventConnected{
					ClientID:     clientID2,
					ConnectionID: connectionID2,
					RequestID:    uuid.NewV4().String(),
				}),
			})
			So(err, ShouldBeNil)

			output, err := babyStationList.GetSnapshot(ctx)
			So(err, ShouldBeNil)
			So(output.Snapshot.SessionByID, ShouldHaveLength, 2)
			So(output.Snapshot.SessionIDByConnectionID, ShouldHaveLength, 2)
			So(output.Snapshot.ConnectionByID, ShouldHaveLength, 2)
			So(output.Snapshot.List(), ShouldHaveLength, 2)
			So(output.Cursor, ShouldEqual, 4)

			// Validate babyStation 1
			babyStation := output.Snapshot.List()[0]
			if babyStation.ClientID == clientID1 {
				So(babyStation.Name, ShouldEqual, sessionName1)
				So(babyStation.StartedAt, ShouldHappenWithin, time.Millisecond, sessionStartedAt1)
			} else {
				So(babyStation.ClientID, ShouldEqual, clientID2)
				So(babyStation.Name, ShouldEqual, sessionName2)
				So(babyStation.StartedAt, ShouldHappenWithin, time.Millisecond, sessionStartedAt2)
			}

			// Validate session 2
			babyStation = output.Snapshot.List()[1]
			if babyStation.ClientID == clientID2 {
				So(babyStation.Name, ShouldEqual, sessionName2)
				So(babyStation.StartedAt, ShouldHappenWithin, time.Millisecond, sessionStartedAt2)
			} else {
				So(babyStation.ClientID, ShouldEqual, clientID1)
				So(babyStation.Name, ShouldEqual, sessionName1)
				So(babyStation.StartedAt, ShouldHappenWithin, time.Millisecond, sessionStartedAt1)
			}
		})
	})
}

func PrintJSON(v interface{}) {
	data, err := json.MarshalIndent(v, "", "  ")
	fatal.OnError(err)
	fmt.Println(string(data))
}
