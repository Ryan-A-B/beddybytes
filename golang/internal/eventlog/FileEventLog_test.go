package eventlog_test

import (
	"context"
	"os"
	"testing"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

type FileEventLogFactory struct {
	pattern string
}

func (factory *FileEventLogFactory) Create(ctx context.Context) eventlog.EventLog {
	folderPath, err := os.MkdirTemp("testdata", factory.pattern)
	if err != nil {
		panic(err)
	}
	eventLog := eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
		FolderPath: folderPath,
	})
	return eventLog
}

func TestFileEventLog(t *testing.T) {
	testEventLog(t, &FileEventLogFactory{
		pattern: "TestFileEventLog-*",
	})
}

func BenchmarkFileEventLogAppend(b *testing.B) {
	benchmarkAppend(b, &FileEventLogFactory{
		pattern: "BenchmarkFileEventLog-*",
	})
}

func BenchmarkFileEventLogEventIterator(b *testing.B) {
	benchmarkEventIterator(b, &FileEventLogFactory{
		pattern: "BenchmarkFileEventLog-*",
	})
}
