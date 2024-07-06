package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/ansel1/merry"
	"github.com/gorilla/mux"

	"github.com/Ryan-A-B/beddybytes/backend/internal"
	"github.com/Ryan-A-B/beddybytes/backend/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/backend/internal/xhttp"
	"github.com/Ryan-A-B/beddybytes/internal/fatal"
)

const EventTypeSessionStarted = "session.started"
const EventTypeSessionEnded = "session.ended"

type StartSessionEventData struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	HostConnectionID string    `json:"host_connection_id"`
	StartedAt        time.Time `json:"started_at"`
}

func (session *StartSessionEventData) validate() error {
	if session.ID == "" {
		return merry.New("session id is empty").WithHTTPCode(http.StatusBadRequest)
	}
	if session.Name == "" {
		return merry.New("session name is empty").WithHTTPCode(http.StatusBadRequest)
	}
	if session.HostConnectionID == "" {
		return merry.New("host connection id is empty").WithHTTPCode(http.StatusBadRequest)
	}
	return nil
}

type Session struct {
	AccountID        string    `json:"-"`
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	HostConnectionID string    `json:"host_connection_id"`
	StartedAt        time.Time `json:"started_at"`
}

func (handlers *Handlers) ListSessions(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			log.Println(err)
			xhttp.Error(responseWriter, err)
		}
	}()
	ctx := request.Context()
	accountID := internal.GetAccountIDFromContext(ctx)
	sessions := handlers.SessionProjection.SessionStore.List(accountID)
	json.NewEncoder(responseWriter).Encode(sessions)
}

func (handlers *Handlers) StartSession(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			log.Println(err)
			xhttp.Error(responseWriter, err)
		}
	}()
	ctx := request.Context()
	vars := mux.Vars(request)
	sessionID := vars["session_id"]
	var session StartSessionEventData
	err = json.NewDecoder(request.Body).Decode(&session)
	if err != nil {
		err = merry.WithHTTPCode(err, http.StatusBadRequest)
		return
	}
	err = session.validate()
	if err != nil {
		return
	}
	if session.ID != sessionID {
		err = merry.Errorf("session id in path does not match session id in body").WithHTTPCode(http.StatusBadRequest)
		return
	}
	_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
		Type:      EventTypeSessionStarted,
		AccountID: internal.GetAccountIDFromContext(ctx),
		Data:      fatal.UnlessMarshalJSON(session),
	})
	if err != nil {
		return
	}
	// TODO set header with logical clock of the start event
}

type EndSessionEventData struct {
	ID string `json:"id"`
}

func (handlers *Handlers) EndSession(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			log.Println(err)
			xhttp.Error(responseWriter, err)
		}
	}()
	ctx := request.Context()
	vars := mux.Vars(request)
	sessionID := vars["session_id"]
	// TODO check we know about the session?
	// expect a header with the logical clock of the start event
	_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
		Type:      EventTypeSessionEnded,
		AccountID: internal.GetAccountIDFromContext(ctx),
		Data:      fatal.UnlessMarshalJSON(&EndSessionEventData{ID: sessionID}),
	})
	if err != nil {
		return
	}
}

type SessionProjection struct {
	SessionStore SessionStore
	Head         int64
}

func (projection *SessionProjection) ApplyEvent(ctx context.Context, event *eventlog.Event) {
	switch event.Type {
	case EventTypeSessionStarted:
		projection.ApplySessionStartedEvent(event)
	case EventTypeSessionEnded:
		projection.ApplySessionEndedEvent(event)
	case EventTypeClientDisconnected:
		projection.ApplyClientDisconnectedEvent(event)
	}
	projection.Head = event.LogicalClock
}

func (projection *SessionProjection) ApplySessionStartedEvent(event *eventlog.Event) {
	var session StartSessionEventData
	fatal.UnlessUnmarshalJSON(event.Data, &session)
	projection.SessionStore.Put(&Session{
		AccountID:        event.AccountID,
		ID:               session.ID,
		Name:             session.Name,
		HostConnectionID: session.HostConnectionID,
		StartedAt:        session.StartedAt,
	})
}

func (projection *SessionProjection) ApplySessionEndedEvent(event *eventlog.Event) {
	var data EndSessionEventData
	fatal.UnlessUnmarshalJSON(event.Data, &data)
	projection.SessionStore.Remove(event.AccountID, data.ID)
}

func (projection *SessionProjection) ApplyClientDisconnectedEvent(event *eventlog.Event) {
	var data ClientDisconnectedEventData
	fatal.UnlessUnmarshalJSON(event.Data, &data)
	sessions := projection.SessionStore.List(event.AccountID)
	for _, session := range sessions {
		if session.HostConnectionID == data.ConnectionID {
			projection.SessionStore.Remove(event.AccountID, session.ID)
		}
	}
}
