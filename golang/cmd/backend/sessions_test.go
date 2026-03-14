package main

import (
	"context"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/sessionstore"
)

func BenchmarkSessionProjectionRealData(b *testing.B) {
	ctx := context.Background()
	eventLogPath := findBackendRealEventLogPath(b)
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
		FolderPath: eventLogPath,
	})
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		projection := newBenchmarkSessionProjection()
		iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
		for iterator.Next(ctx) {
			projection.ApplyEvent(ctx, iterator.Event())
		}
	}
	b.StopTimer()

	runtime.GC()
	var before runtime.MemStats
	runtime.ReadMemStats(&before)

	projection := newBenchmarkSessionProjection()
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
	for iterator.Next(ctx) {
		projection.ApplyEvent(ctx, iterator.Event())
	}

	runtime.GC()
	var after runtime.MemStats
	runtime.ReadMemStats(&after)

	store := projection.SessionStore.(*sessionstore.InMemory)
	liveBytes := int64(after.Alloc) - int64(before.Alloc)
	if liveBytes < 0 {
		liveBytes = 0
	}
	b.ReportMetric(float64(liveBytes), "live-B")
	b.ReportMetric(float64(len(store.List(""))), "sessions")
}

func newBenchmarkSessionProjection() *SessionProjection {
	return &SessionProjection{
		SessionStore: &sessionstore.InMemory{},
	}
}

func findBackendRealEventLogPath(tb testing.TB) string {
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
