package sessionlist_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/sessionlist"
)

func TestSessionList(t *testing.T) {
	Convey("TestSessionList", t, func() {
		ctx := context.Background()
		accountID := uuid.NewV4().String()
		ctx = contextx.WithAccountID(ctx, accountID)
		folderPath, err := os.MkdirTemp("testdata", "TestSessionList-*")
		So(err, ShouldBeNil)
		log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
			FolderPath: folderPath,
		})
		sessionList := sessionlist.New(ctx, sessionlist.NewInput{
			Log: log,
		})
		Convey("List Empty", func() {
			output := sessionList.List(ctx)
			So(output.Sessions, ShouldBeEmpty)
		})
		Convey("Start a session", func() {
			sessionID := uuid.NewV4().String()
			sessionName := uuid.NewV4().String()
			hostConnectionID := uuid.NewV4().String()
			sessionStartedEventData := sessionlist.SessionStartedEventData{
				ID:               sessionID,
				Name:             sessionName,
				HostConnectionID: hostConnectionID,
				StartedAt:        time.Now(),
			}
			data, err := json.Marshal(sessionStartedEventData)
			So(err, ShouldBeNil)
			_, err = log.Append(ctx, &eventlog.AppendInput{
				Type:      sessionlist.EventTypeSessionStarted,
				AccountID: accountID,
				Data:      data,
			})
			So(err, ShouldBeNil)
			output := sessionList.List(ctx)
			So(output.Sessions, ShouldHaveLength, 1)
			Convey("Start another session", func() {
				Convey("Same account", func() {
					Convey("Smaller Session ID", func() {
						otherSessionID := "00000000"
						sessionName := uuid.NewV4().String()
						hostConnectionID := uuid.NewV4().String()
						sessionStartedEventData := sessionlist.SessionStartedEventData{
							ID:               otherSessionID,
							Name:             sessionName,
							HostConnectionID: hostConnectionID,
							StartedAt:        time.Now(),
						}
						data, err := json.Marshal(sessionStartedEventData)
						So(err, ShouldBeNil)
						_, err = log.Append(ctx, &eventlog.AppendInput{
							Type:      sessionlist.EventTypeSessionStarted,
							AccountID: accountID,
							Data:      data,
						})
						So(err, ShouldBeNil)
						output := sessionList.List(ctx)
						So(output.Sessions, ShouldHaveLength, 2)
						Convey("End the", func() {
							Convey("Initial session", func() {
								sessionEndedEventData := sessionlist.SessionEndedEventData{
									ID: sessionID,
								}
								data, err := json.Marshal(sessionEndedEventData)
								So(err, ShouldBeNil)
								_, err = log.Append(ctx, &eventlog.AppendInput{
									Type:      sessionlist.EventTypeSessionEnded,
									AccountID: accountID,
									Data:      data,
								})
								So(err, ShouldBeNil)
								output := sessionList.List(ctx)
								So(output.Sessions, ShouldHaveLength, 1)
								session := output.Sessions[0]
								So(session.ID, ShouldEqual, otherSessionID)
							})
							Convey("Other session", func() {
								sessionEndedEventData := sessionlist.SessionEndedEventData{
									ID: otherSessionID,
								}
								data, err := json.Marshal(sessionEndedEventData)
								So(err, ShouldBeNil)
								_, err = log.Append(ctx, &eventlog.AppendInput{
									Type:      sessionlist.EventTypeSessionEnded,
									AccountID: accountID,
									Data:      data,
								})
								So(err, ShouldBeNil)
								output := sessionList.List(ctx)
								So(output.Sessions, ShouldHaveLength, 1)
								session := output.Sessions[0]
								So(session.ID, ShouldEqual, sessionID)
							})
						})
					})
					Convey("Larger Session ID", func() {
						otherSessionID := "ffffffff"
						sessionName := uuid.NewV4().String()
						hostConnectionID := uuid.NewV4().String()
						sessionStartedEventData := sessionlist.SessionStartedEventData{
							ID:               otherSessionID,
							Name:             sessionName,
							HostConnectionID: hostConnectionID,
							StartedAt:        time.Now(),
						}
						data, err := json.Marshal(sessionStartedEventData)
						So(err, ShouldBeNil)
						_, err = log.Append(ctx, &eventlog.AppendInput{
							Type:      sessionlist.EventTypeSessionStarted,
							AccountID: accountID,
							Data:      data,
						})
						So(err, ShouldBeNil)
						output := sessionList.List(ctx)
						So(output.Sessions, ShouldHaveLength, 2)
						Convey("End the", func() {
							Convey("Initial session", func() {
								sessionEndedEventData := sessionlist.SessionEndedEventData{
									ID: sessionID,
								}
								data, err := json.Marshal(sessionEndedEventData)
								So(err, ShouldBeNil)
								_, err = log.Append(ctx, &eventlog.AppendInput{
									Type:      sessionlist.EventTypeSessionEnded,
									AccountID: accountID,
									Data:      data,
								})
								So(err, ShouldBeNil)
								output := sessionList.List(ctx)
								So(output.Sessions, ShouldHaveLength, 1)
								session := output.Sessions[0]
								So(session.ID, ShouldEqual, otherSessionID)
							})
							Convey("Other session", func() {
								sessionEndedEventData := sessionlist.SessionEndedEventData{
									ID: otherSessionID,
								}
								data, err := json.Marshal(sessionEndedEventData)
								So(err, ShouldBeNil)
								_, err = log.Append(ctx, &eventlog.AppendInput{
									Type:      sessionlist.EventTypeSessionEnded,
									AccountID: accountID,
									Data:      data,
								})
								So(err, ShouldBeNil)
								output := sessionList.List(ctx)
								So(output.Sessions, ShouldHaveLength, 1)
								session := output.Sessions[0]
								So(session.ID, ShouldEqual, sessionID)
							})
						})
					})
				})
				Convey("Different account", func() {
					Convey("Smaller Account ID", func() {
						otherAccountID := "00000000"
						ctx := contextx.WithAccountID(ctx, otherAccountID)
						sessionID := uuid.NewV4().String()
						sessionName := uuid.NewV4().String()
						hostConnectionID := uuid.NewV4().String()
						sessionStartedEventData := sessionlist.SessionStartedEventData{
							ID:               sessionID,
							Name:             sessionName,
							HostConnectionID: hostConnectionID,
							StartedAt:        time.Now(),
						}
						data, err := json.Marshal(sessionStartedEventData)
						So(err, ShouldBeNil)
						_, err = log.Append(ctx, &eventlog.AppendInput{
							Type:      sessionlist.EventTypeSessionStarted,
							AccountID: otherAccountID,
							Data:      data,
						})
						So(err, ShouldBeNil)
						output := sessionList.List(ctx)
						So(output.Sessions, ShouldHaveLength, 1)
						Convey("List original account", func() {
							ctx := contextx.WithAccountID(ctx, accountID)
							output = sessionList.List(ctx)
							So(output.Sessions, ShouldHaveLength, 1)
						})
					})
					Convey("Larger Account ID", func() {
						otherAccountID := "ffffffff"
						ctx := contextx.WithAccountID(ctx, otherAccountID)
						sessionID := uuid.NewV4().String()
						sessionName := uuid.NewV4().String()
						hostConnectionID := uuid.NewV4().String()
						sessionStartedEventData := sessionlist.SessionStartedEventData{
							ID:               sessionID,
							Name:             sessionName,
							HostConnectionID: hostConnectionID,
							StartedAt:        time.Now(),
						}
						data, err := json.Marshal(sessionStartedEventData)
						So(err, ShouldBeNil)
						_, err = log.Append(ctx, &eventlog.AppendInput{
							Type:      sessionlist.EventTypeSessionStarted,
							AccountID: otherAccountID,
							Data:      data,
						})
						So(err, ShouldBeNil)
						output := sessionList.List(ctx)
						So(output.Sessions, ShouldHaveLength, 1)
						Convey("List original account", func() {
							ctx := contextx.WithAccountID(ctx, accountID)
							output = sessionList.List(ctx)
							So(output.Sessions, ShouldHaveLength, 1)
						})
					})
				})
			})
			Convey("End the session", func() {
				sessionEndedEventData := sessionlist.SessionEndedEventData{
					ID: sessionID,
				}
				data, err := json.Marshal(sessionEndedEventData)
				So(err, ShouldBeNil)
				_, err = log.Append(ctx, &eventlog.AppendInput{
					Type:      sessionlist.EventTypeSessionEnded,
					AccountID: accountID,
					Data:      data,
				})
				So(err, ShouldBeNil)
				output := sessionList.List(ctx)
				So(output.Sessions, ShouldBeEmpty)
			})
		})
	})
}
