package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/ansel1/merry"
	"github.com/gorilla/mux"

	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/sessions"
	"github.com/Ryan-A-B/beddybytes/golang/internal/sessionstore"
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

func (handlers *Handlers) StartSession(responseWriter http.ResponseWriter, request *http.Request) {
	var err error
	defer func() {
		if err != nil {
			log.Println(err)
			httpx.Error(responseWriter, err)
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
	_, err = handlers.EventLog.Append(ctx, eventlog.AppendInput{
		Type:      EventTypeSessionStarted,
		AccountID: contextx.GetAccountID(ctx),
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
			httpx.Error(responseWriter, err)
		}
	}()
	ctx := request.Context()
	vars := mux.Vars(request)
	sessionID := vars["session_id"]
	// TODO check we know about the session?
	// expect a header with the logical clock of the start event
	_, err = handlers.EventLog.Append(ctx, eventlog.AppendInput{
		Type:      EventTypeSessionEnded,
		AccountID: contextx.GetAccountID(ctx),
		Data:      fatal.UnlessMarshalJSON(&EndSessionEventData{ID: sessionID}),
	})
	if err != nil {
		return
	}
}

type SessionProjection struct {
	SessionStore sessionstore.SessionStore
	Head         int64
}

func (projection *SessionProjection) ApplyEvent(ctx context.Context, event *eventlog.Event) {
	switch event.Type {
	case EventTypeSessionStarted:
		projection.applySessionStartedEvent(event)
	case EventTypeSessionEnded:
		projection.applySessionEndedEvent(event)
	}
	projection.Head = event.LogicalClock
}

func (projection *SessionProjection) applySessionStartedEvent(event *eventlog.Event) {
	var session StartSessionEventData
	fatal.UnlessUnmarshalJSON(event.Data, &session)
	projection.SessionStore.Put(&sessions.Session{
		AccountID:        event.AccountID,
		ID:               session.ID,
		Name:             session.Name,
		HostConnectionID: session.HostConnectionID,
		StartedAt:        session.StartedAt,
	})
}

func (projection *SessionProjection) applySessionEndedEvent(event *eventlog.Event) {
	var data EndSessionEventData
	fatal.UnlessUnmarshalJSON(event.Data, &data)
	projection.SessionStore.Remove(event.AccountID, data.ID)
}
