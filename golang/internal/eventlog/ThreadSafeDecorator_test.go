package eventlog_test

import (
	"os"
	"testing"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

type ThreadSafeDecoratorFactory struct{}

func (factory *ThreadSafeDecoratorFactory) Create() eventlog.EventLog {
	folderPath, err := os.MkdirTemp("testdata", "TestThreadSafeDecorator-*")
	if err != nil {
		panic(err)
	}
	eventLog := eventlog.NewThreadSafeDecorator(&eventlog.NewThreadSafeDecoratorInput{
		Decorated: eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
			FolderPath: folderPath,
		}),
	})
	return eventLog
}

func TestThreadSafeDecorator(t *testing.T) {
	testEventLog(t, new(ThreadSafeDecoratorFactory))
}
