package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/ansel1/merry"
	"github.com/gorilla/mux"

	"github.com/Ryan-A-B/baby-monitor/backend/internal"
	"github.com/Ryan-A-B/baby-monitor/backend/internal/eventlog"
	"github.com/Ryan-A-B/baby-monitor/backend/internal/xhttp"
	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
)

const EventTypeSessionStarted = "session.start"
const EventTypeSessionEnded = "session.end"

type SessionStarted struct {
	SessionID    string `json:"session_id"`
	HostClientID string `json:"host_client_id"`
}

type StartSessionInput struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	HostConnectionID string    `json:"host_connection_id"`
	StartedAt        time.Time `json:"started_at"`
}

func (session *StartSessionInput) validate() error {
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
	var session StartSessionInput
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
		Data:      fatal.UnlessMarshalJSON(sessionID),
	})
	if err != nil {
		return
	}
}

type SessionProjection struct {
	SessionStore SessionStore
	Head         int
}

func (projection *SessionProjection) ApplyEvent(ctx context.Context, event *eventlog.Event) {
	switch event.Type {
	case EventTypeSessionStarted:
		projection.ApplySessionStartedEvent(event)
	case EventTypeSessionEnded:
		projection.ApplySessionEndedEvent(event)
	}
	projection.Head = event.LogicalClock
}

func (projection *SessionProjection) ApplySessionStartedEvent(event *eventlog.Event) {
	var session StartSessionInput
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
	var sessionID string
	fatal.UnlessUnmarshalJSON(event.Data, &sessionID)
	projection.SessionStore.Remove(event.AccountID, sessionID)
}
