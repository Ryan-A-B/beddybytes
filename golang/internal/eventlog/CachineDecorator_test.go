package eventlog_test

import (
	"context"
	"os"
	"testing"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

type CachingDecoratorFactory struct {
	pattern string
}

func (factory *CachingDecoratorFactory) Create(ctx context.Context) eventlog.EventLog {
	folderPath, err := os.MkdirTemp("testdata", factory.pattern)
	if err != nil {
		panic(err)
	}
	eventLog, err := eventlog.NewCachingDecorator(ctx, eventlog.NewCachingDecoratorInput{
		Decorated: eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
			FolderPath: folderPath,
		}),
	})
	if err != nil {
		panic(err)
	}
	return eventLog
}

func TestCachingDecorator(t *testing.T) {
	testEventLog(t, &CachingDecoratorFactory{
		pattern: "TestCachingDecorator-*",
	})
}

func BenchmarkCachingDecoratorAppend(b *testing.B) {
	benchmarkAppend(b, &CachingDecoratorFactory{
		pattern: "BenchmarkCachingDecorator-*",
	})
}

func BenchmarkCachingDecoratorEventIterator(b *testing.B) {
	benchmarkEventIterator(b, &CachingDecoratorFactory{
		pattern: "BenchmarkCachingDecorator-*",
	})
}
