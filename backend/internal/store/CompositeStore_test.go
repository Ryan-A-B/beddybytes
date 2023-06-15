package store_test

import (
	"context"
	"testing"

	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/baby-monitor/backend/internal/store"
)

func TestCompositeStore(t *testing.T) {
	Convey("TestCompositeStore", t, func() {
		ctx := context.Background()
		memoryStore := store.NewMemoryStore()
		fsStore := store.NewFileSystemStore(&store.NewFileSystemStoreInput{
			Root: "testdata",
		})
		compositeStore := &store.CompositeStore{
			Stores: []store.Store{memoryStore, fsStore},
		}
		testStore(t, compositeStore)
		Convey("Put", func() {
			key := uuid.NewV4().String()
			expectedData := uuid.NewV4().Bytes()
			err := compositeStore.Put(ctx, key, expectedData)
			So(err, ShouldBeNil)
			actualData, err := memoryStore.Get(ctx, key)
			So(err, ShouldBeNil)
			So(actualData, ShouldResemble, expectedData)
			actualData, err = fsStore.Get(ctx, key)
			So(err, ShouldBeNil)
			So(actualData, ShouldResemble, expectedData)
			Convey("Delete", func() {
				err := compositeStore.Delete(ctx, key)
				So(err, ShouldBeNil)
				_, err = memoryStore.Get(ctx, key)
				So(err, ShouldNotBeNil)
				_, err = fsStore.Get(ctx, key)
				So(err, ShouldNotBeNil)
			})
		})
	})
}
