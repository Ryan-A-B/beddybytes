package sortedset_test

import (
	"testing"

	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/baby-monitor/backend/internal/sortedset"
)

type Object struct {
	ID    string
	Index int
	Value string
}

func (item *Object) Less(other *Object) bool {
	if item.ID < other.ID {
		return true
	}
	if item.Index < other.Index {
		return true
	}
	return false
}

func (item *Object) Equal(other *Object) bool {
	return item.ID == other.ID && item.Index == other.Index
}

type ObjectPrefix Object

func (prefix *ObjectPrefix) Less(item *Object) bool {
	return prefix.ID < item.ID
}

func (prefix *ObjectPrefix) Equal(item *Object) bool {
	return prefix.ID == item.ID
}

func TestSortedSet(t *testing.T) {
	Convey("TestSortedSet", t, func() {
		var sortedSet sortedset.SortedSet[*Object] = &sortedset.SortedSetInMemory[*Object]{}
		Convey("put", func() {
			id := uuid.NewV4().String()
			item := Object{
				ID:    id,
				Index: 0,
				Value: uuid.NewV4().String(),
			}
			sortedSet.Put(&item)
			Convey("get", func() {
				Convey("found", func() {
					actualItem, found := sortedSet.Get(&Object{
						ID:    id,
						Index: 0,
					})
					So(found, ShouldBeTrue)
					So(actualItem, ShouldResemble, &item)
				})
				Convey("not found", func() {
					Convey("different id", func() {
						actualItem, found := sortedSet.Get(&Object{
							ID:    uuid.NewV4().String(),
							Index: 0,
						})
						So(found, ShouldBeFalse)
						So(actualItem, ShouldBeNil)
					})
					Convey("different index", func() {
						actualItem, found := sortedSet.Get(&Object{
							ID:    id,
							Index: 1,
						})
						So(found, ShouldBeFalse)
						So(actualItem, ShouldBeNil)
					})
				})
			})
			Convey("list", func() {
				items := sortedSet.List(&ObjectPrefix{
					ID: id,
				})
				So(items, ShouldResemble, []*Object{
					&item,
				})
			})
			Convey("remove", func() {
				Convey("present", func() {
					sortedSet.Remove(&Object{
						ID:    id,
						Index: 0,
					})
					Convey("list", func() {
						items := sortedSet.List(&ObjectPrefix{
							ID: id,
						})
						So(items, ShouldBeEmpty)
					})
				})
				Convey("not present", func() {
					Convey("different id", func() {
						sortedSet.Remove(&Object{
							ID:    uuid.NewV4().String(),
							Index: 0,
						})
						Convey("list", func() {
							items := sortedSet.List(&ObjectPrefix{
								ID: id,
							})
							So(items, ShouldResemble, []*Object{
								&item,
							})
						})
					})
				})
				Convey("different index", func() {
					sortedSet.Remove(&Object{
						ID:    id,
						Index: 1,
					})
					Convey("list", func() {
						items := sortedSet.List(&ObjectPrefix{
							ID: id,
						})
						So(items, ShouldResemble, []*Object{
							&item,
						})
					})
				})
			})
			Convey("put", func() {
				Convey("same id", func() {
					item2 := Object{
						ID:    id,
						Index: 1,
					}
					sortedSet.Put(&item2)
					Convey("list", func() {
						items := sortedSet.List(&ObjectPrefix{
							ID: id,
						})
						So(items, ShouldResemble, []*Object{
							&item,
							&item2,
						})
					})
				})
				Convey("different id", func() {
					id2 := uuid.NewV4().String()
					item2 := Object{
						ID:    id2,
						Index: 0,
						Value: uuid.NewV4().String(),
					}
					sortedSet.Put(&item2)
					Convey("list", func() {
						items := sortedSet.List(&ObjectPrefix{
							ID: id,
						})
						So(items, ShouldResemble, []*Object{
							&item,
						})
						items = sortedSet.List(&ObjectPrefix{
							ID: id2,
						})
						So(items, ShouldResemble, []*Object{
							&item2,
						})
					})
				})
			})
		})
	})
}
