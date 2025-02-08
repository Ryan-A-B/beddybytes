package store_test

import (
	"context"
	"crypto/rand"
	"io"
	mathrand "math/rand"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/store"
	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"
)

func testStore(t *testing.T, s store.Store) {
	mathrand.Seed(time.Now().UnixNano())
	Convey("TestStore", func() {
		ctx := context.Background()
		Convey("Put", func() {
			key := uuid.NewV4().String()
			dataSize := mathrand.Intn(1000)
			expectedData := make([]byte, dataSize)
			_, err := io.ReadFull(rand.Reader, expectedData)
			So(err, ShouldBeNil)
			err = s.Put(ctx, key, expectedData)
			So(err, ShouldBeNil)
			Convey("Get", func() {
				actualData, err := s.Get(ctx, key)
				So(err, ShouldBeNil)
				So(actualData, ShouldResemble, expectedData)
			})
			Convey("Delete", func() {
				err := s.Delete(ctx, key)
				So(err, ShouldBeNil)
				Convey("Get", func() {
					_, err := s.Get(ctx, key)
					So(err, ShouldNotBeNil)
				})
			})
		})
	})
}
