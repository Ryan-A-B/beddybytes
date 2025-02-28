package main

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

func TestUsageStats(t *testing.T) {
	Convey("TestUsageStats", t, func() {
		ctx := context.Background()
		folderPath, err := os.MkdirTemp("testdata", "TestUsageStats-*")
		So(err, ShouldBeNil)
		log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
			FolderPath: folderPath,
		})
		stats := NewUsageStats(ctx, NewUsageStatsInput{
			Log: log,
		})
		So(stats.GetTotalDuration(ctx), ShouldEqual, 0)
		So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 0)
		Convey("start session", func() {
			accountID := uuid.NewV4().String()
			hostClientID := uuid.NewV4().String()
			hostConnectionID := uuid.NewV4().String()
			expectedDuration := time.Hour
			sessionStartedData := StartSessionEventData{
				ID:               uuid.NewV4().String(),
				Name:             "test",
				HostConnectionID: hostConnectionID,
				StartedAt:        time.Now().Add(-expectedDuration),
			}
			data, err := json.Marshal(sessionStartedData)
			So(err, ShouldBeNil)
			_, err = log.Append(ctx, &eventlog.AppendInput{
				Type:      EventTypeSessionStarted,
				AccountID: accountID,
				Data:      data,
			})
			So(err, ShouldBeNil)
			So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
			So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 1)
			Convey("wait a second", func() {
				sleepDuration := time.Second
				time.Sleep(sleepDuration)
				expectedDuration += sleepDuration
				So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
				So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 1)
			})
			Convey("end session", func() {
				sessionEndedData := EndSessionEventData{
					ID: sessionStartedData.ID,
				}
				data, err := json.Marshal(sessionEndedData)
				So(err, ShouldBeNil)
				_, err = log.Append(ctx, &eventlog.AppendInput{
					Type:      EventTypeSessionEnded,
					AccountID: accountID,
					Data:      data,
				})
				So(err, ShouldBeNil)
				So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
				So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 0)
				Convey("wait a second", func() {
					time.Sleep(time.Second)
					So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
					So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 0)
				})
			})
			Convey("host connects", func() {
				clientConnectedData := ClientConnectedEventData{
					ClientID:     hostClientID,
					ConnectionID: hostConnectionID,
					RequestID:    uuid.NewV4().String(),
				}
				data, err := json.Marshal(clientConnectedData)
				So(err, ShouldBeNil)
				_, err = log.Append(ctx, &eventlog.AppendInput{
					Type:      EventTypeClientConnected,
					AccountID: accountID,
					Data:      data,
				})
				So(err, ShouldBeNil)
				So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
				So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 1)
				Convey("host connection ends", func() {
					Convey("clean", func() {
						clientDisconnectedData := ClientDisconnectedEventData{
							ClientID:           hostClientID,
							ConnectionID:       hostConnectionID,
							RequestID:          clientConnectedData.RequestID,
							WebSocketCloseCode: 1000,
						}
						data, err := json.Marshal(clientDisconnectedData)
						So(err, ShouldBeNil)
						_, err = log.Append(ctx, &eventlog.AppendInput{
							Type:      EventTypeClientDisconnected,
							AccountID: accountID,
							Data:      data,
						})
						So(err, ShouldBeNil)
						So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
						So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 0)
						Convey("wait a second", func() {
							time.Sleep(time.Second)
							So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
							So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 0)
						})
					})
					Convey("unclean", func() {
						clientDisconnectedData := ClientDisconnectedEventData{
							ClientID:           hostClientID,
							ConnectionID:       hostConnectionID,
							RequestID:          clientConnectedData.RequestID,
							WebSocketCloseCode: 1006,
						}
						data, err := json.Marshal(clientDisconnectedData)
						So(err, ShouldBeNil)
						_, err = log.Append(ctx, &eventlog.AppendInput{
							Type:      EventTypeClientDisconnected,
							AccountID: accountID,
							Data:      data,
						})
						So(err, ShouldBeNil)
						So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
						So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 1)
						Convey("wait a second", func() {
							time.Sleep(time.Second)
							So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
							So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 1)
						})
						Convey("host connects again", func() {
							clientConnectedData := ClientConnectedEventData{
								ClientID:     hostClientID,
								ConnectionID: hostConnectionID,
								RequestID:    uuid.NewV4().String(),
							}
							data, err := json.Marshal(clientConnectedData)
							So(err, ShouldBeNil)
							_, err = log.Append(ctx, &eventlog.AppendInput{
								Type:      EventTypeClientConnected,
								AccountID: accountID,
								Data:      data,
							})
							So(err, ShouldBeNil)
							So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
							So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 1)
							Convey("wait a second", func() {
								sleepDuration := time.Second
								time.Sleep(sleepDuration)
								expectedDuration += sleepDuration
								So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
								So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 1)
							})
						})
					})
				})
				Convey("server restarts", func() {
					_, err = log.Append(ctx, &eventlog.AppendInput{
						Type:      EventTypeServerStarted,
						AccountID: accountID,
						Data:      nil,
					})
					So(err, ShouldBeNil)
					So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
					So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 1)
					Convey("wait a second", func() {
						time.Sleep(time.Second)
						So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
						So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 1)
					})
					Convey("client connects", func() {
						clientConnectedData := ClientConnectedEventData{
							ClientID:     hostClientID,
							ConnectionID: hostConnectionID,
							RequestID:    uuid.NewV4().String(),
						}
						data, err := json.Marshal(clientConnectedData)
						So(err, ShouldBeNil)
						_, err = log.Append(ctx, &eventlog.AppendInput{
							Type:      EventTypeClientConnected,
							AccountID: accountID,
							Data:      data,
						})
						So(err, ShouldBeNil)
						So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
						So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 1)
						Convey("wait a second", func() {
							sleepDuration := time.Second
							time.Sleep(sleepDuration)
							expectedDuration += sleepDuration
							So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
							So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 1)
						})
					})
				})
			})
		})
	})
}
