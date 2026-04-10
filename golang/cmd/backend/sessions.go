package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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
	SessionID       string `json:"session_id"`
	ClientID        string `json:"client_id"`
	ConnectionID    string `json:"connection_id"`
	Name            string `json:"name"`
	StartedAtMillis int64  `json:"started_at_millis"`
}

func (input *CreateSessionInput) validate() error {
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
	sessionID := mux.Vars(request)["session_id"]
	requestBody, err := io.ReadAll(request.Body)
	if err != nil {
		err = merry.WithHTTPCode(err, http.StatusBadRequest)
		return
	}
	input, err := parseStartSessionInput(requestBody, sessionID)
	if err != nil {
		return
	}
	if input.ClientID == "" {
		connection, ok := handlers.ConnectionHub.Get(input.ConnectionID)
		if ok && connection.AccountID == accountID {
			input.ClientID = connection.ClientID
		}
	}
	if input.ClientID == "" {
		handlers.PendingSessionStarts.Put(accountID, input)
		return
	}
	if err = handlers.publishBabyStationAnnouncement(accountID, input); err != nil {
		return
	}
}

func parseStartSessionInput(data []byte, sessionID string) (CreateSessionInput, error) {
	var legacyInput StartSessionEventData
	if err := json.Unmarshal(data, &legacyInput); err != nil {
		return CreateSessionInput{}, merry.WithHTTPCode(err, http.StatusBadRequest)
	}
	if err := legacyInput.validate(); err != nil {
		return CreateSessionInput{}, err
	}
	if legacyInput.ID != sessionID {
		return CreateSessionInput{}, merry.Errorf("session id in path does not match session id in body").WithHTTPCode(http.StatusBadRequest)
	}
	return CreateSessionInput{
		SessionID:       legacyInput.ID,
		ClientID:        "",
		ConnectionID:    legacyInput.HostConnectionID,
		Name:            legacyInput.Name,
		StartedAtMillis: legacyInput.StartedAt.UnixMilli(),
	}, nil
}

func (handlers *Handlers) publishBabyStationAnnouncement(accountID string, input CreateSessionInput) error {
	topic := fmt.Sprintf("accounts/%s/baby_stations", accountID)
	payload, err := json.Marshal(input)
	if err != nil {
		return err
	}
	return mqttx.Wait(handlers.MQTTClient.Publish(topic, 1, false, payload))
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
	sessionID := mux.Vars(request)["session_id"]
	accountID := contextx.GetAccountID(ctx)
	data, err := json.Marshal(EndSessionEventData{
		ID: sessionID,
	})
	if err != nil {
		return
	}
	_, err = handlers.EventLog.Append(ctx, eventlog.AppendInput{
		Type:      EventTypeSessionEnded,
		AccountID: accountID,
		Data:      data,
	})
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
	var data StartSessionEventData
	fatal.UnlessUnmarshalJSON(event.Data, &data)
	projection.SessionStore.Put(&sessions.Session{
		AccountID:        event.AccountID,
		ID:               data.ID,
		Name:             data.Name,
		HostConnectionID: data.HostConnectionID,
		StartedAt:        data.StartedAt,
	})
}

func (projection *SessionProjection) applySessionEndedEvent(event *eventlog.Event) {
	var data EndSessionEventData
	fatal.UnlessUnmarshalJSON(event.Data, &data)
	projection.SessionStore.Remove(event.AccountID, data.ID)
}
