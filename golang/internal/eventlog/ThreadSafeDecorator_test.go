package eventlog_test

import (
	"context"
	"os"
	"testing"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

type ThreadSafeDecoratorFactory struct{}

func (factory *ThreadSafeDecoratorFactory) Create(ctx context.Context) eventlog.EventLog {
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
