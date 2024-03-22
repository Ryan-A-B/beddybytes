package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/ansel1/merry"

	"github.com/Ryan-A-B/beddybytes/backend/internal"
	"github.com/Ryan-A-B/beddybytes/backend/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/backend/internal/xhttp"
	"github.com/Ryan-A-B/beddybytes/internal/fatal"
)

const EventTypeServerStarted = "server.started"

type Event struct {
	ID            string          `json:"id"`
	Type          string          `json:"type"`
	LogicalClock  int             `json:"logical_clock"`
	UnixTimestamp int64           `json:"unix_timestamp"`
	Data          json.RawMessage `json:"data"`
}

func (handlers *Handlers) GetEvents(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			xhttp.Error(responseWriter, err)
		}
	}()
	ctx := request.Context()
	accountID := internal.GetAccountIDFromContext(ctx)
	fromCursor, err := IntFormValue(request, "from_cursor", 0)
	if err != nil {
		return
	}
	responseWriter.Header().Set("Content-Type", "text/event-stream")
	// TODO ensure GetEventIterator respects ctx.Done()
	events := handlers.EventLog.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
		FromCursor: fromCursor,
	})
	for events.Next() {
		event := events.Event()
		if ShouldSkipEvent(accountID, event) {
			continue
		}
		WriteEvent(responseWriter, event)
	}
	fatal.OnError(events.Err())
	// TODO keep alive?
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

func IntFormValue(request *http.Request, key string, defaultValue int) (value int, err error) {
	v := request.FormValue(key)
	if v == "" {
		value = defaultValue
		return
	}
	value, err = strconv.Atoi(v)
	if err != nil {
		err = merry.Prepend(err, "invalid value for "+key).WithHTTPCode(http.StatusBadRequest)
		return
	}
	return
}
