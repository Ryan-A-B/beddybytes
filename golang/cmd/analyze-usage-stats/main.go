package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/cmd/analyze-usage-stats/internal/fullstate"
	"github.com/Ryan-A-B/beddybytes/golang/cmd/analyze-usage-stats/internal/lowmemory"
	"github.com/Ryan-A-B/beddybytes/golang/cmd/analyze-usage-stats/internal/shared"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

func main() {
	ctx := context.Background()
	eventLogPath := flag.String("eventlog-path", defaultEventLogPath(), "Path to the file event log folder")
	cacheSizesFlag := flag.String("cache-sizes", "4", "Comma-separated disconnected-session cache sizes to simulate")
	flag.Parse()

	cacheSizes, err := parseCacheSizes(*cacheSizesFlag)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}

	events, err := loadEvents(ctx, *eventLogPath)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if len(events) == 0 {
		fmt.Fprintln(os.Stderr, "no events found")
		os.Exit(1)
	}

	referenceTime := shared.EventTime(events[len(events)-1]).Add(time.Second)
	fullStateStats := fullstate.New()
	for _, event := range events {
		fullStateStats.Apply(event)
	}
	fullStateTotal := fullStateStats.TotalDuration(referenceTime)

	fmt.Printf("eventlog_path: %s\n", *eventLogPath)
	fmt.Printf("events: %d\n", len(events))
	fmt.Printf("reference_time: %s\n", referenceTime.Format(time.RFC3339))
	fmt.Printf("fullstate_total_hours: %.3f\n", fullStateTotal.Hours())
	fmt.Printf("fullstate_ended_while_disconnected: %d\n", fullStateStats.EndedWhileDisconnectedCount)
	fmt.Printf("fullstate_ended_while_disconnected_gap_hours: %.3f\n\n", fullStateStats.EndedWhileDisconnectedGap.Hours())

	fmt.Println("cache  lowmemory_hours  delta_vs_fullstate_hours  reconnects  ended_disc  ended_disc_gap_hours  missed_reconnects  missed_gap_hours  evicted  final_active  final_disconnected")
	for _, cacheSize := range cacheSizes {
		lowMemoryStats := lowmemory.New(cacheSize)
		for _, event := range events {
			lowMemoryStats.Apply(event)
		}
		lowMemoryTotal := lowMemoryStats.TotalDuration(referenceTime)
		fmt.Printf(
			"%5d  %13.3f  %11.3f  %10d  %10d  %20.3f  %17d  %16.3f  %7d  %12d  %18d\n",
			cacheSize,
			lowMemoryTotal.Hours(),
			(lowMemoryTotal - fullStateTotal).Hours(),
			lowMemoryStats.ReconnectCount,
			lowMemoryStats.EndedWhileDisconnectedCount,
			lowMemoryStats.EndedWhileDisconnectedGap.Hours(),
			lowMemoryStats.MissedReconnectCount,
			lowMemoryStats.MissedReconnectGap.Hours(),
			lowMemoryStats.EvictedCount,
			len(lowMemoryStats.SessionInfoByID),
			lowMemoryStats.FinalDisconnectedCount(),
		)
	}
}

func parseCacheSizes(cacheSizesFlag string) ([]int, error) {
	parts := strings.Split(cacheSizesFlag, ",")
	cacheSizes := make([]int, 0, len(parts))
	seen := make(map[int]struct{})
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		cacheSize, err := strconv.Atoi(part)
		if err != nil {
			return nil, fmt.Errorf("invalid cache size %q", part)
		}
		if cacheSize < 0 {
			return nil, fmt.Errorf("cache size must be >= 0: %d", cacheSize)
		}
		if _, ok := seen[cacheSize]; ok {
			continue
		}
		seen[cacheSize] = struct{}{}
		cacheSizes = append(cacheSizes, cacheSize)
	}
	sort.Ints(cacheSizes)
	return cacheSizes, nil
}

func loadEvents(ctx context.Context, eventLogPath string) ([]*eventlog.Event, error) {
	log := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
		FolderPath: eventLogPath,
	})
	iterator := log.GetEventIterator(ctx, eventlog.GetEventIteratorInput{})
	events := make([]*eventlog.Event, 0, 1024)
	for iterator.Next(ctx) {
		event := iterator.Event()
		copyEvent := *event
		events = append(events, &copyEvent)
	}
	if err := iterator.Err(); err != nil {
		return nil, err
	}
	return events, nil
}

func defaultEventLogPath() string {
	candidates := []string{
		filepath.Join("eventlog"),
		filepath.Join("..", "..", "..", "eventlog"),
	}
	for _, candidate := range candidates {
		if _, err := os.Stat(filepath.Join(candidate, eventlog.EventsFileName)); err == nil {
			return candidate
		}
	}
	return "eventlog"
}
