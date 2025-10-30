package main

import (
	"fmt"
	"net/http"
	"regexp"

	"github.com/ansel1/merry"
)

var urnPattern = regexp.MustCompile(`^urn:([a-z0-9-]*):([a-z0-9-]*):([a-z0-9-]*):([a-z0-9_-]+)/(.+)$`)

type URN struct {
	Service      string
	Region       string
	AccountID    string
	ResourceType string
	ResourceID   string
}

func (urn *URN) String() string {
	return fmt.Sprintf("urn:%s:%s:%s:%s/%s", urn.Service, urn.Region, urn.AccountID, urn.ResourceType, urn.ResourceID)
}

func (urn *URN) MarshalText() (text []byte, err error) {
	return []byte(urn.String()), nil
}

func (urn *URN) UnmarshalText(text []byte) (err error) {
	matches := urnPattern.FindSubmatch(text)
	if len(matches) != 6 {
		err = merry.New("invalid urn").WithHTTPCode(http.StatusBadRequest)
		return
	}
	urn.Service = string(matches[1])
	urn.Region = string(matches[2])
	urn.AccountID = string(matches[3])
	urn.ResourceType = string(matches[4])
	urn.ResourceID = string(matches[5])
	return
}
