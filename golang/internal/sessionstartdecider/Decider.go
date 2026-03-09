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

var ErrDuplicate = errors.New("duplicate")

type Session struct {
	AccountID        string
	ID               string
	Name             string
	HostConnectionID string
	StartedAt        time.Time
}

type Decider struct {
	eventLog        eventlog.EventLog
	mutex           sync.Mutex
	cursor          int64
	connectionIDSet map[string]struct{}
}

type NewDeciderInput struct {
	EventLog eventlog.EventLog
}

func NewDecider(input NewDeciderInput) *Decider {
	return &Decider{
		eventLog:        input.EventLog,
		connectionIDSet: make(map[string]struct{}),
	}
}

func (decider *Decider) Put(ctx context.Context, session Session) error {
	decider.mutex.Lock()
	defer decider.mutex.Unlock()

	if err := decider.catchUp(ctx); err != nil {
		return err
	}
	key := decider.getKey(session.AccountID, session.HostConnectionID)
	if _, ok := decider.connectionIDSet[key]; ok {
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
			decider.cursor = event.LogicalClock
			continue
		}
		var data sessionStartedEventData
		if err := json.Unmarshal(event.Data, &data); err != nil {
			return err
		}
		key := decider.getKey(event.AccountID, data.HostConnectionID)
		decider.connectionIDSet[key] = struct{}{}
		decider.cursor = event.LogicalClock
	}
	return iterator.Err()
}

func (decider *Decider) getKey(accountID string, connectionID string) string {
	return fmt.Sprintf("accounts/%s/connections/%s", accountID, connectionID)
}

type sessionStartedEventData struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	HostConnectionID string    `json:"host_connection_id"`
	StartedAt        time.Time `json:"started_at"`
}
