package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"
)

var benchmarkUsageStatsDurationSink time.Duration
var benchmarkUsageStatsActiveSessionsSink int

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
			_, err = log.Append(ctx, eventlog.AppendInput{
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
				_, err = log.Append(ctx, eventlog.AppendInput{
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
				}
				data, err := json.Marshal(clientConnectedData)
				So(err, ShouldBeNil)
				_, err = log.Append(ctx, eventlog.AppendInput{
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
							ClientID:     hostClientID,
							ConnectionID: hostConnectionID,
						}
						clientDisconnectedData.Disconnected.Reason = "clean"
						data, err := json.Marshal(clientDisconnectedData)
						So(err, ShouldBeNil)
						_, err = log.Append(ctx, eventlog.AppendInput{
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
							ClientID:     hostClientID,
							ConnectionID: hostConnectionID,
						}
						clientDisconnectedData.Disconnected.Reason = "unexpected"
						data, err := json.Marshal(clientDisconnectedData)
						So(err, ShouldBeNil)
						_, err = log.Append(ctx, eventlog.AppendInput{
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
						Convey("host connects again", func() {
							clientConnectedData := ClientConnectedEventData{
								ClientID:     hostClientID,
								ConnectionID: hostConnectionID,
							}
							data, err := json.Marshal(clientConnectedData)
							So(err, ShouldBeNil)
							_, err = log.Append(ctx, eventlog.AppendInput{
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
					_, err = log.Append(ctx, eventlog.AppendInput{
						Type:      EventTypeServerStarted,
						AccountID: accountID,
						Data:      nil,
					})
					So(err, ShouldBeNil)
					So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
					So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 0)
					Convey("wait a second", func() {
						time.Sleep(time.Second)
						So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, time.Second)
						So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 0)
					})
					Convey("client connects", func() {
						clientConnectedData := ClientConnectedEventData{
							ClientID:     hostClientID,
							ConnectionID: hostConnectionID,
						}
						data, err := json.Marshal(clientConnectedData)
						So(err, ShouldBeNil)
						_, err = log.Append(ctx, eventlog.AppendInput{
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

func TestUsageStatsDisconnectedSessionCache(t *testing.T) {
	Convey("Disconnected sessions are capped per account", t, func() {
		ctx := context.Background()
		folderPath, err := os.MkdirTemp("testdata", "TestUsageStatsDisconnectedSessionCache-*")
		So(err, ShouldBeNil)
		log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
			FolderPath: folderPath,
		})
		stats := NewUsageStats(ctx, NewUsageStatsInput{
			Log: log,
		})
		accountID := uuid.NewV4().String()
		for i := 0; i < maxDisconnectedSessionsPerAccount+2; i++ {
			connectionID := uuid.NewV4().String()
			sessionStartedData := StartSessionEventData{
				ID:               uuid.NewV4().String(),
				Name:             "test",
				HostConnectionID: connectionID,
				StartedAt:        time.Now().Add(-time.Hour),
			}
			data, err := json.Marshal(sessionStartedData)
			So(err, ShouldBeNil)
			_, err = log.Append(ctx, eventlog.AppendInput{
				Type:      EventTypeSessionStarted,
				AccountID: accountID,
				Data:      data,
			})
			So(err, ShouldBeNil)
			clientDisconnectedData := ClientDisconnectedEventData{
				ClientID:           uuid.NewV4().String(),
				ConnectionID:       connectionID,
				RequestID:          uuid.NewV4().String(),
				WebSocketCloseCode: 1006,
			}
			data, err = json.Marshal(clientDisconnectedData)
			So(err, ShouldBeNil)
			_, err = log.Append(ctx, eventlog.AppendInput{
				Type:      EventTypeClientDisconnected,
				AccountID: accountID,
				Data:      data,
			})
			So(err, ShouldBeNil)
		}

		So(stats.GetCountOfActiveSessions(ctx), ShouldEqual, 0)
		So(len(stats.disconnectedSessionsByAccountID[accountID]), ShouldEqual, maxDisconnectedSessionsPerAccount)
		So(len(stats.disconnectedSessionByConnectionID), ShouldEqual, maxDisconnectedSessionsPerAccount)
	})
}

func TestUsageStatsEvictedDisconnectedSessionsStillCountTowardsDuration(t *testing.T) {
	Convey("Evicted disconnected sessions keep their accrued duration", t, func() {
		ctx := context.Background()
		folderPath, err := os.MkdirTemp("testdata", "TestUsageStatsEvictedDisconnectedSessionsStillCountTowardsDuration-*")
		So(err, ShouldBeNil)
		log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
			FolderPath: folderPath,
		})
		stats := NewUsageStats(ctx, NewUsageStatsInput{
			Log: log,
		})
		accountID := uuid.NewV4().String()
		expectedDuration := time.Duration(0)
		for i := 0; i < maxDisconnectedSessionsPerAccount+2; i++ {
			connectionID := uuid.NewV4().String()
			sessionStartedData := StartSessionEventData{
				ID:               uuid.NewV4().String(),
				Name:             "test",
				HostConnectionID: connectionID,
				StartedAt:        time.Now().Add(-time.Hour),
			}
			expectedDuration += time.Hour
			data, err := json.Marshal(sessionStartedData)
			So(err, ShouldBeNil)
			_, err = log.Append(ctx, eventlog.AppendInput{
				Type:      EventTypeSessionStarted,
				AccountID: accountID,
				Data:      data,
			})
			So(err, ShouldBeNil)
			clientDisconnectedData := ClientDisconnectedEventData{
				ClientID:           uuid.NewV4().String(),
				ConnectionID:       connectionID,
				RequestID:          uuid.NewV4().String(),
				WebSocketCloseCode: 1006,
			}
			data, err = json.Marshal(clientDisconnectedData)
			So(err, ShouldBeNil)
			_, err = log.Append(ctx, eventlog.AppendInput{
				Type:      EventTypeClientDisconnected,
				AccountID: accountID,
				Data:      data,
			})
			So(err, ShouldBeNil)
		}

		So(stats.GetTotalDuration(ctx), ShouldAlmostEqual, expectedDuration, 10*time.Second)
		So(len(stats.disconnectedSessionsByAccountID[accountID]), ShouldEqual, maxDisconnectedSessionsPerAccount)
		So(len(stats.disconnectedSessionByConnectionID), ShouldEqual, maxDisconnectedSessionsPerAccount)
	})
}

func TestUsageStatsIncludesOfflineTimeAfterUncleanDisconnect(t *testing.T) {
	Convey("UsageStats continues counting peer session time across backend disconnects", t, func() {
		ctx := context.Background()
		stats := NewUsageStats(ctx, NewUsageStatsInput{})
		accountID := "account-1"
		sessionID := "session-1"
		connectionID := "connection-1"
		baseTime := time.Unix(1_700_000_000, 0).UTC()

		stats.applyEvent(ctx, usageStatsEvent(accountID, EventTypeSessionStarted, baseTime, StartSessionEventData{
			ID:               sessionID,
			Name:             "test",
			HostConnectionID: connectionID,
			StartedAt:        baseTime,
		}))
		stats.applyEvent(ctx, usageStatsEvent(accountID, EventTypeClientDisconnected, baseTime.Add(time.Hour), ClientDisconnectedEventData{
			ClientID:           "client-1",
			ConnectionID:       connectionID,
			RequestID:          "request-1",
			WebSocketCloseCode: 1006,
		}))
		stats.applyEvent(ctx, usageStatsEvent(accountID, EventTypeClientConnected, baseTime.Add(3*time.Hour), ClientConnectedEventData{
			ClientID:     "client-1",
			ConnectionID: connectionID,
			RequestID:    "request-2",
		}))
		stats.applyEvent(ctx, usageStatsEvent(accountID, EventTypeClientDisconnected, baseTime.Add(5*time.Hour), ClientDisconnectedEventData{
			ClientID:           "client-1",
			ConnectionID:       connectionID,
			RequestID:          "request-3",
			WebSocketCloseCode: 1006,
		}))
		stats.applyEvent(ctx, usageStatsEvent(accountID, EventTypeSessionEnded, baseTime.Add(8*time.Hour), EndSessionEventData{
			ID: sessionID,
		}))

		So(stats.durationByAccountID[accountID], ShouldEqual, 8*time.Hour)
		So(len(stats.sessionInfoByID), ShouldEqual, 0)
		So(len(stats.disconnectedSessionByID), ShouldEqual, 0)
		So(len(stats.disconnectedSessionByConnectionID), ShouldEqual, 0)
	})
}

// Baseline on 2026-03-13 against the downloaded eventlog (~145k events):
// 1 iteration, ~1.08s/op, 141345840 B/op, 2501740 allocs/op, 87088 live-B,
// 86 accounts, 1 session, 165 disconnected cached sessions.
func BenchmarkUsageStatsRealData(b *testing.B) {
	ctx := context.Background()
	eventLogPath := findRealEventLogPath(b)
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
		FolderPath: eventLogPath,
	})
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		stats := NewUsageStats(ctx, NewUsageStatsInput{
			Log: log,
		})
		benchmarkUsageStatsDurationSink = stats.GetTotalDuration(ctx)
		benchmarkUsageStatsActiveSessionsSink = stats.GetCountOfActiveSessions(ctx)
	}
	b.StopTimer()

	runtime.GC()
	var before runtime.MemStats
	runtime.ReadMemStats(&before)

	stats := NewUsageStats(ctx, NewUsageStatsInput{
		Log: log,
	})
	benchmarkUsageStatsDurationSink = stats.GetTotalDuration(ctx)
	benchmarkUsageStatsActiveSessionsSink = stats.GetCountOfActiveSessions(ctx)

	runtime.GC()
	var after runtime.MemStats
	runtime.ReadMemStats(&after)

	liveBytes := int64(after.Alloc) - int64(before.Alloc)
	if liveBytes < 0 {
		liveBytes = 0
	}
	b.ReportMetric(float64(liveBytes), "live-B")
	b.ReportMetric(float64(len(stats.durationByAccountID)), "accounts")
	b.ReportMetric(float64(len(stats.sessionInfoByID)), "sessions")
	b.ReportMetric(float64(len(stats.disconnectedSessionByConnectionID)), "disconnected")
}

func findRealEventLogPath(tb testing.TB) string {
	tb.Helper()
	_, filePath, _, ok := runtime.Caller(0)
	if !ok {
		tb.Fatal("failed to locate benchmark file path")
	}
	dir := filepath.Dir(filePath)
	for {
		goModPath := filepath.Join(dir, "go.mod")
		if _, err := os.Stat(goModPath); err == nil {
			eventLogPath := filepath.Join(dir, "eventlog")
			eventsPath := filepath.Join(eventLogPath, eventlog.EventsFileName)
			if _, err := os.Stat(eventsPath); err == nil {
				return eventLogPath
			}
			tb.Skipf("real eventlog not found at %s", eventLogPath)
		}
		parentDir := filepath.Dir(dir)
		if parentDir == dir {
			tb.Fatal("failed to locate repository root")
		}
		dir = parentDir
	}
}

func usageStatsEvent(accountID string, eventType string, eventTime time.Time, data interface{}) *eventlog.Event {
	rawData, err := json.Marshal(data)
	if err != nil {
		panic(err)
	}
	return &eventlog.Event{
		Type:          eventType,
		AccountID:     accountID,
		UnixTimestamp: eventTime.Unix(),
		Data:          rawData,
	}
}
