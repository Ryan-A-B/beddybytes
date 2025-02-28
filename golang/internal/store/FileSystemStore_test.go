package store_test

import (
	"testing"

	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/beddybytes/golang/internal/store"
)

func TestFileSystemStore(t *testing.T) {
	Convey("TestFileSystemStore", t, func() {
		fsStore := store.NewFileSystemStore(&store.NewFileSystemStoreInput{
			Root: "testdata",
		})
		testStore(t, fsStore)
	})
}
