package sortedset

import "sort"

type Item[T any] interface {
	Less(other T) bool
	Equal(other T) bool
}

type SortedSet[T Item[T]] interface {
	Put(item T)
	Get(key T) (item T, found bool)
	List(prefix Item[T]) []T
	Remove(key T)
}

type SortedSetInMemory[T Item[T]] struct {
	Items []T
}

func (sortedSet *SortedSetInMemory[T]) Put(item T) {
	index := sortedSet.search(item)
	if index == len(sortedSet.Items) {
		sortedSet.Items = append(sortedSet.Items, item)
		return
	}
	other := sortedSet.Items[index]
	if item.Equal(other) {
		return
	}
	sortedSet.Items = append(sortedSet.Items, item)
	copy(sortedSet.Items[index+1:], sortedSet.Items[index:])
	sortedSet.Items[index] = item
}

func (sortedSet *SortedSetInMemory[T]) Get(key T) (item T, found bool) {
	index := sortedSet.search(key)
	if index == len(sortedSet.Items) {
		return
	}
	other := sortedSet.Items[index]
	found = other.Equal(key)
	if !found {
		return
	}
	item = other
	return
}

func (sortedSet *SortedSetInMemory[T]) List(prefix Item[T]) []T {
	firstIndex := sort.Search(len(sortedSet.Items), func(i int) bool {
		if prefix.Equal(sortedSet.Items[i]) {
			return true
		}
		return prefix.Less(sortedSet.Items[i])
	})
	if firstIndex == len(sortedSet.Items) {
		return nil
	}
	n := sort.Search(len(sortedSet.Items)-firstIndex, func(i int) bool {
		return prefix.Less(sortedSet.Items[firstIndex+i])
	})
	lastIndex := firstIndex + n
	return sortedSet.Items[firstIndex:lastIndex]
}

func (sortedSet *SortedSetInMemory[T]) Remove(key T) {
	index := sortedSet.search(key)
	if index == len(sortedSet.Items) {
		return
	}
	other := sortedSet.Items[index]
	if !other.Equal(key) {
		return
	}
	sortedSet.Items = append(sortedSet.Items[:index], sortedSet.Items[index+1:]...)
}

func (sortedSet *SortedSetInMemory[T]) search(item T) int {
	return sort.Search(len(sortedSet.Items), func(i int) bool {
		return !sortedSet.Items[i].Less(item)
	})
}
