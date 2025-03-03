package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
	"github.com/ansel1/merry"
)

const EventTypeServerStarted = "server.started"

type Event struct {
	ID            string          `json:"id"`
	Type          string          `json:"type"`
	LogicalClock  int64           `json:"logical_clock"`
	UnixTimestamp int64           `json:"unix_timestamp"`
	Data          json.RawMessage `json:"data"`
}

func (handlers *Handlers) GetEvents(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			httpx.Error(responseWriter, err)
		}
	}()
	ctx := request.Context()
	accountID := contextx.GetAccountID(ctx)
	fromCursor, err := Int64FormValue(request, "from_cursor", 0)
	if err != nil {
		return
	}
	responseWriter.Header().Set("Content-Type", "text/event-stream")
	eventC := make(chan *eventlog.Event)
	go func() {
		defer close(eventC)
		events := handlers.EventLog.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
			FromCursor: fromCursor,
		})
		for events.Next(ctx) {
			event := events.Event()
			if ShouldSkipEvent(accountID, event) {
				continue
			}
			eventC <- event
		}
		fatal.OnError(events.Err())
	}()
	ticker := time.NewTicker(30 * time.Second)
	for {
		select {
		case event, ok := <-eventC:
			if !ok {
				return
			}
			WriteEvent(responseWriter, event)
		case <-ticker.C:
			io.WriteString(responseWriter, ": keep-alive\n\n")
		}
	}
}

func ShouldSkipEvent(accountID string, event *eventlog.Event) bool {
	if event.Type == EventTypeServerStarted {
		return false
	}
	return event.AccountID != accountID
}

func WriteEvent(responseWriter http.ResponseWriter, event *eventlog.Event) {
	payload := Event{
		ID:            event.ID,
		Type:          event.Type,
		LogicalClock:  event.LogicalClock,
		UnixTimestamp: event.UnixTimestamp,
		Data:          event.Data,
	}
	data := fatal.UnlessMarshalJSON(&payload)
	// Send generic event to allow javascript to handle all events with a single handler, is there a better way?
	message := fmt.Sprintf("data: %s\n\n", data)
	io.WriteString(responseWriter, message)
	if flusher, ok := responseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func Int64FormValue(request *http.Request, key string, defaultValue int64) (value int64, err error) {
	v := request.FormValue(key)
	if v == "" {
		value = defaultValue
		return
	}
	value, err = strconv.ParseInt(v, 10, 64)
	if err != nil {
		err = merry.Prepend(err, "invalid value for "+key).WithHTTPCode(http.StatusBadRequest)
		return
	}
	return
}
