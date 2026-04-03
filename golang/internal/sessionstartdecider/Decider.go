package sessionstartdecider

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

const EventTypeSessionStarted = "session.started"
const EventTypeSessionEnded = "session.ended"

var ErrDuplicate = errors.New("duplicate")

type Session struct {
	AccountID        string
	ID               string
	Name             string
	HostConnectionID string
	StartedAt        time.Time
}

type Decider struct {
	eventLog                  eventlog.EventLog
	mutex                     sync.Mutex
	cursor                    int64
	sessionKeyByConnectionKey map[string]string
	connectionKeyBySessionKey map[string]string
	endedSessionKeySet        map[string]struct{}
}

type NewDeciderInput struct {
	EventLog eventlog.EventLog
}

func NewDecider(input NewDeciderInput) *Decider {
	return &Decider{
		eventLog:                  input.EventLog,
		sessionKeyByConnectionKey: make(map[string]string),
		connectionKeyBySessionKey: make(map[string]string),
		endedSessionKeySet:        make(map[string]struct{}),
	}
}

func (decider *Decider) Put(ctx context.Context, session Session) error {
	decider.mutex.Lock()
	defer decider.mutex.Unlock()

	if err := decider.catchUp(ctx); err != nil {
		return err
	}
	connectionKey := decider.getKey(session.AccountID, session.HostConnectionID)
	sessionKey := decider.getSessionKey(session.AccountID, session.ID)
	if _, ok := decider.endedSessionKeySet[sessionKey]; ok {
		return ErrDuplicate
	}
	if existingSessionKey, ok := decider.sessionKeyByConnectionKey[connectionKey]; ok && existingSessionKey == sessionKey {
		return ErrDuplicate
	}
	data, err := json.Marshal(sessionStartedEventData{
		ID:               session.ID,
		Name:             session.Name,
		HostConnectionID: session.HostConnectionID,
		StartedAt:        session.StartedAt,
	})
	if err != nil {
		return err
	}
	_, err = decider.eventLog.Append(ctx, eventlog.AppendInput{
		Type:      EventTypeSessionStarted,
		AccountID: session.AccountID,
		Data:      data,
	})
	return err
}

func (decider *Decider) catchUp(ctx context.Context) error {
	iterator := decider.eventLog.GetEventIterator(ctx, eventlog.GetEventIteratorInput{
		FromCursor: decider.cursor,
	})
	for iterator.Next(ctx) {
		event := iterator.Event()
		if event.Type != EventTypeSessionStarted {
			if event.Type == EventTypeSessionEnded {
				var data sessionEndedEventData
				if err := json.Unmarshal(event.Data, &data); err != nil {
					return err
				}
				sessionKey := decider.getSessionKey(event.AccountID, data.ID)
				connectionKey, ok := decider.connectionKeyBySessionKey[sessionKey]
				if ok {
					delete(decider.sessionKeyByConnectionKey, connectionKey)
					delete(decider.connectionKeyBySessionKey, sessionKey)
				}
				decider.endedSessionKeySet[sessionKey] = struct{}{}
			}
			decider.cursor = event.LogicalClock
			continue
		}
		var data sessionStartedEventData
		if err := json.Unmarshal(event.Data, &data); err != nil {
			return err
		}
		connectionKey := decider.getKey(event.AccountID, data.HostConnectionID)
		sessionKey := decider.getSessionKey(event.AccountID, data.ID)
		if _, ended := decider.endedSessionKeySet[sessionKey]; ended {
			decider.cursor = event.LogicalClock
			continue
		}
		if replacedSessionKey, ok := decider.sessionKeyByConnectionKey[connectionKey]; ok && replacedSessionKey != sessionKey {
			delete(decider.connectionKeyBySessionKey, replacedSessionKey)
		}
		if replacedConnectionKey, ok := decider.connectionKeyBySessionKey[sessionKey]; ok && replacedConnectionKey != connectionKey {
			delete(decider.sessionKeyByConnectionKey, replacedConnectionKey)
		}
		decider.sessionKeyByConnectionKey[connectionKey] = sessionKey
		decider.connectionKeyBySessionKey[sessionKey] = connectionKey
		decider.cursor = event.LogicalClock
	}
	return iterator.Err()
}

func (decider *Decider) getKey(accountID string, connectionID string) string {
	return fmt.Sprintf("accounts/%s/connections/%s", accountID, connectionID)
}

func (decider *Decider) getSessionKey(accountID string, sessionID string) string {
	return fmt.Sprintf("accounts/%s/sessions/%s", accountID, sessionID)
}

type sessionStartedEventData struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	HostConnectionID string    `json:"host_connection_id"`
	StartedAt        time.Time `json:"started_at"`
}

type sessionEndedEventData struct {
	ID string `json:"id"`
}
