package sessionlist

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

func BenchmarkSessionListRealData(b *testing.B) {
	ctx := context.Background()
	eventLogPath := findRealEventLogPath(b)
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
		FolderPath: eventLogPath,
	})
	ctx = contextx.WithAccountID(ctx, "")
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		sessionList := New(ctx, NewInput{
			Log: log,
		})
		sessionList.List(ctx)
	}
	b.StopTimer()

	runtime.GC()
	var before runtime.MemStats
	runtime.ReadMemStats(&before)

	sessionList := New(ctx, NewInput{
		Log: log,
	})
	sessionList.List(ctx)

	runtime.GC()
	var after runtime.MemStats
	runtime.ReadMemStats(&after)

	liveBytes := int64(after.Alloc) - int64(before.Alloc)
	if liveBytes < 0 {
		liveBytes = 0
	}
	b.ReportMetric(float64(liveBytes), "live-B")
	b.ReportMetric(float64(len(sessionList.sessions)), "sessions")
	disconnectedCount := 0
	for _, sessions := range sessionList.disconnectedSessionsByAccountID {
		disconnectedCount += len(sessions)
	}
	b.ReportMetric(float64(disconnectedCount), "disconnected")
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
