package store2_test

import (
	"context"
	"testing"

	"github.com/Ryan-A-B/beddybytes/golang/internal/store2"
	. "github.com/smartystreets/goconvey/convey"
)

func TestJSONEncodingDecorator(t *testing.T) {
	ctx := context.Background()
	Convey("TestJSONEncodingDecorator", t, func() {
		var store store2.Store[string, int] = store2.JSONEncodingDecorator[string, int]{
			Decorated: make(store2.StoreInMemory[string, []byte]),
		}
		Convey("Put", func() {
			var err error
			err = store.Put(ctx, "foo", 1)
			So(err, ShouldBeNil)
			err = store.Put(ctx, "bar", 2)
			So(err, ShouldBeNil)
			Convey("Get", func() {
				var value int
				value, err = store.Get(ctx, "foo")
				So(err, ShouldBeNil)
				So(value, ShouldEqual, 1)
				value, err = store.Get(ctx, "bar")
				So(err, ShouldBeNil)
				So(value, ShouldEqual, 2)
				Convey("Delete", func() {
					err = store.Delete(ctx, "foo")
					So(err, ShouldBeNil)
					_, err = store.Get(ctx, "foo")
					So(err, ShouldNotBeNil)
					err = store.Delete(ctx, "bar")
					So(err, ShouldBeNil)
					_, err = store.Get(ctx, "bar")
					So(err, ShouldNotBeNil)
				})
			})
		})
	})
}
