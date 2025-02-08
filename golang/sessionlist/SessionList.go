package sessionlist

import (
	"context"
	"encoding/json"
	"sort"
	"sync"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/connections"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
)

type SessionList struct {
	mutex    sync.Mutex
	log      eventlog.EventLog
	cursor   int64
	sessions []*Session
}

type NewInput struct {
	Log eventlog.EventLog
}

func New(ctx context.Context, input NewInput) *SessionList {
	return &SessionList{
		log: input.Log,
	}
}

type ListOutput struct {
	Cursor   int64      `json:"cursor"`
	Sessions []*Session `json:"sessions"`
}

func (sessionList *SessionList) List(ctx context.Context) (output ListOutput) {
	sessionList.catchUp(ctx)
	accountID := internal.GetAccountIDFromContext(ctx)
	index := sort.Search(len(sessionList.sessions), func(i int) bool {
		return sessionList.sessions[i].AccountID >= accountID
	})
	output.Cursor = sessionList.cursor
	output.Sessions = make([]*Session, 0, len(sessionList.sessions)-index)
	for i := index; i < len(sessionList.sessions); i++ {
		session := sessionList.sessions[i]
		if session.AccountID != accountID {
			return
		}
		output.Sessions = append(output.Sessions, session)
	}
	return
}

func (sessionList *SessionList) catchUp(ctx context.Context) {
	sessionList.mutex.Lock()
	defer sessionList.mutex.Unlock()
	iterator := sessionList.log.GetEventIterator(ctx, &eventlog.GetEventIteratorInput{
		FromCursor: sessionList.cursor,
	})
	for iterator.Next(ctx) {
		event := iterator.Event()
		sessionList.apply(ctx, event)
		sessionList.cursor = event.LogicalClock
	}
	fatal.OnError(iterator.Err())
}

func (sessionList *SessionList) apply(ctx context.Context, event *eventlog.Event) {
	apply, ok := applyByType[event.Type]
	if !ok {
		return
	}
	apply(ctx, sessionList, event)
}

func (sessionList *SessionList) put(session *Session) {
	index := sessionList.search(session.AccountID, session.ID)
	if index == len(sessionList.sessions) {
		sessionList.sessions = append(sessionList.sessions, session)
		return
	}
	if sessionList.sessions[index].ID == session.ID {
		sessionList.sessions[index] = session
		return
	}
	sessionList.sessions = append(sessionList.sessions, nil)
	copy(sessionList.sessions[index+1:], sessionList.sessions[index:])
	sessionList.sessions[index] = session
}

func (sessionList *SessionList) delete(accountID string, sessionID string) {
	index := sessionList.search(accountID, sessionID)
	if index == len(sessionList.sessions) {
		return
	}
	session := sessionList.sessions[index]
	if session.AccountID != accountID || session.ID != sessionID {
		return
	}
	sessionList.sessions = append(sessionList.sessions[:index], sessionList.sessions[index+1:]...)
}

func (sessionList *SessionList) search(accountID string, sessionID string) int {
	return sort.Search(len(sessionList.sessions), func(i int) bool {
		if sessionList.sessions[i].AccountID > accountID {
			return true
		}
		if sessionList.sessions[i].AccountID != accountID {
			return false
		}
		return sessionList.sessions[i].ID >= sessionID
	})
}

func (sessionList *SessionList) getSessionByConnectionID(accountID string, connectionID string) (session *Session, ok bool) {
	index := sort.Search(len(sessionList.sessions), func(i int) bool {
		return sessionList.sessions[i].AccountID >= accountID
	})
	for i := index; i < len(sessionList.sessions); i++ {
		session = sessionList.sessions[i]
		if session.AccountID != accountID {
			return
		}
		if session.HostConnectionID == connectionID {
			ok = true
			return
		}
	}
	return
}

type applyFunc func(ctx context.Context, sessionList *SessionList, event *eventlog.Event)

const EventTypeServerStarted = "server.started"
const EventTypeSessionStarted = "session.started"
const EventTypeSessionEnded = "session.ended"

var applyByType = map[string]applyFunc{
	EventTypeServerStarted:            applyServerStartedEvent,
	EventTypeSessionStarted:           applySessionStartedEvent,
	EventTypeSessionEnded:             applySessionEndedEvent,
	connections.EventTypeConnected:    applyClientConnectedEvent,
	connections.EventTypeDisconnected: applyClientDisconnectedEvent,
}

type SessionStartedEventData struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	HostConnectionID string    `json:"host_connection_id"`
	StartedAt        time.Time `json:"started_at"`
}

func applySessionStartedEvent(ctx context.Context, sessionList *SessionList, event *eventlog.Event) {
	var sessionStartedEventData SessionStartedEventData
	err := json.Unmarshal(event.Data, &sessionStartedEventData)
	fatal.OnError(err)
	existingSession, ok := sessionList.getSessionByConnectionID(event.AccountID, sessionStartedEventData.HostConnectionID)
	if ok {
		sessionList.delete(event.AccountID, existingSession.ID)
	}
	sessionList.put(&Session{
		AccountID:        event.AccountID,
		ID:               sessionStartedEventData.ID,
		Name:             sessionStartedEventData.Name,
		HostConnectionID: sessionStartedEventData.HostConnectionID,
		StartedAt:        sessionStartedEventData.StartedAt,
		HostConnectionState: HostConnectionStateConnected{
			HostConnectionStateBase: HostConnectionStateBase{
				State: ConnectionStateConnected,
				Since: event.UnixTimestamp,
			},
			RequestID: "TODO", // TODO
		},
	})
}

type SessionEndedEventData struct {
	ID string `json:"id"`
}

func applySessionEndedEvent(ctx context.Context, sessionList *SessionList, event *eventlog.Event) {
	var sessionEndedEventData SessionEndedEventData
	err := json.Unmarshal(event.Data, &sessionEndedEventData)
	fatal.OnError(err)
	sessionList.delete(event.AccountID, sessionEndedEventData.ID)
}

func applyClientDisconnectedEvent(ctx context.Context, sessionList *SessionList, event *eventlog.Event) {
	var data connections.EventDisconnected
	err := json.Unmarshal(event.Data, &data)
	fatal.OnError(err)
	session, ok := sessionList.getSessionByConnectionID(event.AccountID, data.ConnectionID)
	if !ok {
		return
	}
	if session.HostConnectionState.GetState() != ConnectionStateConnected {
		return
	}
	hostConnectionState := session.HostConnectionState.(HostConnectionStateConnected)
	if hostConnectionState.RequestID != data.RequestID {
		return
	}
	session.HostConnectionState = HostConnectionStateDisconnected{
		HostConnectionStateBase: HostConnectionStateBase{
			State: ConnectionStateDisconnected,
			Since: event.UnixTimestamp,
		},
	}
}

func applyClientConnectedEvent(ctx context.Context, sessionList *SessionList, event *eventlog.Event) {
	var data connections.EventConnected
	err := json.Unmarshal(event.Data, &data)
	fatal.OnError(err)
	session, ok := sessionList.getSessionByConnectionID(event.AccountID, data.ConnectionID)
	if !ok {
		return
	}
	session.HostConnectionState = HostConnectionStateConnected{
		HostConnectionStateBase: HostConnectionStateBase{
			State: ConnectionStateConnected,
			Since: event.UnixTimestamp,
		},
		RequestID: data.RequestID,
	}
}

func applyServerStartedEvent(ctx context.Context, sessionList *SessionList, event *eventlog.Event) {
	for _, session := range sessionList.sessions {
		if session.HostConnectionState.GetState() == ConnectionStateDisconnected {
			continue
		}
		session.HostConnectionState = HostConnectionStateDisconnected{
			HostConnectionStateBase: HostConnectionStateBase{
				State: ConnectionStateDisconnected,
				Since: event.UnixTimestamp,
			},
		}
	}
}
