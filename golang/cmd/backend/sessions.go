package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/ansel1/merry"
	"github.com/gorilla/mux"

	"github.com/Ryan-A-B/beddybytes/golang/internal/contextx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/httpx"
	"github.com/Ryan-A-B/beddybytes/golang/internal/mqttx"
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

type CreateSessionInput struct {
	ClientID        string `json:"client_id"`
	ConnectionID    string `json:"connection_id"`
	Name            string `json:"name"`
	StartedAtMillis int64  `json:"started_at_millis"`
}

func (input *CreateSessionInput) validate() error {
	if input.ClientID == "" {
		return merry.New("client id is empty").WithHTTPCode(http.StatusBadRequest)
	}
	if input.ConnectionID == "" {
		return merry.New("connection id is empty").WithHTTPCode(http.StatusBadRequest)
	}
	if input.Name == "" {
		return merry.New("session name is empty").WithHTTPCode(http.StatusBadRequest)
	}
	if input.StartedAtMillis <= 0 {
		return merry.New("started_at_millis must be positive").WithHTTPCode(http.StatusBadRequest)
	}
	return nil
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
	accountID := contextx.GetAccountID(ctx)
	_ = mux.Vars(request)["session_id"]
	var input CreateSessionInput
	if err = json.NewDecoder(request.Body).Decode(&input); err != nil {
		err = merry.WithHTTPCode(err, http.StatusBadRequest)
		return
	}
	if err = input.validate(); err != nil {
		return
	}
	topic := fmt.Sprintf("accounts/%s/baby_stations", accountID)
	payload, err := json.Marshal(input)
	if err != nil {
		return
	}
	if err = mqttx.Wait(handlers.MQTTClient.Publish(topic, 1, false, payload)); err != nil {
		return
	}
}

type EndSessionEventData struct {
	ID string `json:"id"`
}

func (handlers *Handlers) EndSession(responseWriter http.ResponseWriter, request *http.Request) {
	// Session delete is intentionally a no-op. Session lifecycle now ends on disconnect.
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
