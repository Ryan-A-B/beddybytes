package account

import (
	"encoding/json"
	"net/http"
	"sort"

	"github.com/ansel1/merry"
)

type Tag string

const (
	TagCamera  Tag = "camera"
	TagMonitor Tag = "monitor"
)

func (tag Tag) Validate() (err error) {
	switch tag {
	case TagCamera, TagMonitor:
	default:
		err = merry.New(string(tag) + " is not a valid tag").WithHTTPCode(http.StatusBadRequest)
	}
	return
}

type Tags map[Tag]struct{}

func (tags Tags) Validate() (err error) {
	if len(tags) == 0 {
		err = merry.New("expected at least one tag").WithHTTPCode(http.StatusBadRequest)
		return
	}
	for tag := range tags {
		err = tag.Validate()
		if err != nil {
			return
		}
	}
	return
}

func (tags Tags) Contains(tag Tag) bool {
	_, ok := tags[tag]
	return ok
}

func (tags Tags) MarshalJSON() ([]byte, error) {
	var tagsSlice []string
	for tag := range tags {
		tagsSlice = append(tagsSlice, string(tag))
	}
	sort.Strings(tagsSlice)
	return json.Marshal(tagsSlice)
}

func (tags *Tags) UnmarshalJSON(data []byte) error {
	var tagsSlice []string
	err := json.Unmarshal(data, &tagsSlice)
	if err != nil {
		return err
	}
	*tags = make(Tags)
	for _, tag := range tagsSlice {
		(*tags)[Tag(tag)] = struct{}{}
	}
	return nil
}
