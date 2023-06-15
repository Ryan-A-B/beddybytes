package store_test

import (
	"context"
	"crypto/rand"
	"io"
	mathrand "math/rand"
	"testing"
	"time"

	"github.com/Ryan-A-B/baby-monitor/backend/internal/store"
	. "github.com/smartystreets/goconvey/convey"
)

func TestEncryptingDecorator(t *testing.T) {
	mathrand.Seed(time.Now().UnixNano())
	Convey("TestEncryptingDecorator", t, func() {
		ctx := context.Background()
		key := make([]byte, 32)
		_, err := io.ReadFull(rand.Reader, key)
		So(err, ShouldBeNil)
		memoryStore := store.NewMemoryStore()
		encryptedStore := store.NewEncryptingDecorator(&store.NewEncryptingDecoratorInput{
			Store: memoryStore,
			Key:   key,
		})
		Convey("Put", func() {
			dataSize := mathrand.Intn(40)
			expectedData := make([]byte, dataSize)
			_, err := io.ReadFull(rand.Reader, expectedData)
			So(err, ShouldBeNil)
			err = encryptedStore.Put(ctx, "foo", expectedData)
			So(err, ShouldBeNil)
			actualData, err := memoryStore.Get(ctx, "foo")
			So(err, ShouldBeNil)
			So(actualData, ShouldNotResemble, expectedData)
			Convey("Get", func() {
				actualData, err := encryptedStore.Get(ctx, "foo")
				So(err, ShouldBeNil)
				So(actualData, ShouldResemble, expectedData)
			})
			Convey("Delete", func() {
				err := encryptedStore.Delete(ctx, "foo")
				So(err, ShouldBeNil)
				_, err = encryptedStore.Get(ctx, "foo")
				So(err, ShouldNotBeNil)
			})
		})
	})
}
