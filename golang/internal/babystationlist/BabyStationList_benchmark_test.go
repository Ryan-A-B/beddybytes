package babystationlist

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

func BenchmarkBabyStationListRealData(b *testing.B) {
	ctx := context.Background()
	eventLogPath := findRealEventLogPath(b)
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
		FolderPath: eventLogPath,
	})
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		babyStationList := New(NewInput{
			EventLog: log,
		})
		babyStationList.catchup(ctx)
	}
	b.StopTimer()

	runtime.GC()
	var before runtime.MemStats
	runtime.ReadMemStats(&before)

	babyStationList := New(NewInput{
		EventLog: log,
	})
	babyStationList.catchup(ctx)

	runtime.GC()
	var after runtime.MemStats
	runtime.ReadMemStats(&after)

	liveBytes := int64(after.Alloc) - int64(before.Alloc)
	if liveBytes < 0 {
		liveBytes = 0
	}

	sessionCount := 0
	connectionCount := 0
	for _, snapshot := range babyStationList.snapshotByAccountID {
		sessionCount += len(snapshot.SessionByID)
		connectionCount += len(snapshot.ConnectionByID)
	}
	b.ReportMetric(float64(liveBytes), "live-B")
	b.ReportMetric(float64(sessionCount), "sessions")
	b.ReportMetric(float64(connectionCount), "connections")
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
