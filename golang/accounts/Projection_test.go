package accounts_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/beddybytes/golang/accounts"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/store"
)

func TestProjection(t *testing.T) {
	Convey("Projection", t, func() {
		ctx := context.Background()
		handlers := accounts.Handlers{
			EventLog: newEventLog(ctx),
			AccountStore: &accounts.AccountStore{
				Store: store.NewMemoryStore(),
			},
		}
		go eventlog.Project(ctx, &eventlog.ProjectInput{
			EventLog:   handlers.EventLog,
			FromCursor: 0,
			Apply:      handlers.ApplyEvent,
		})
		Convey("create account", func() {
			user := accounts.NewUser(&accounts.NewUserInput{
				Email:    "test@example.com",
				Password: uuid.NewV4().String(),
			})
			expectedAccount := accounts.Account{
				ID:   uuid.NewV4().String(),
				User: user,
			}
			data, err := json.Marshal(&expectedAccount)
			So(err, ShouldBeNil)
			_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
				Type: accounts.EventTypeAccountCreated,
				Data: data,
			})
			So(err, ShouldBeNil)
			time.Sleep(10 * time.Millisecond)
			account, err := handlers.AccountStore.Get(ctx, expectedAccount.ID)
			So(err, ShouldBeNil)
			So(account, ShouldResemble, &expectedAccount)
		})
	})
}

func newEventLog(ctx context.Context) *eventlog.FollowingDecorator {
	folderPath, err := os.MkdirTemp("testdata", "eventlog-*")
	So(err, ShouldBeNil)
	return eventlog.NewFollowingDecorator(&eventlog.NewFollowingDecoratorInput{
		Decorated: eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
			FolderPath: folderPath,
		}),
		BufferSize: 128,
	})
}
