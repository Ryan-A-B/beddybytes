package eventlog_test

import (
	"os"
	"testing"

	"github.com/Ryan-A-B/baby-monitor/backend/internal/eventlog"
)

type FileEventLogFactory struct {
	pattern string
}

func (factory *FileEventLogFactory) Create() eventlog.EventLog {
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

func BenchmarkFileEventLog(b *testing.B) {
	benchmarkEventLog(b, &FileEventLogFactory{
		pattern: "BenchmarkFileEventLog-*",
	})
}
