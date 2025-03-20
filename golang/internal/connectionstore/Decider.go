package connectionstore

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sync"

	"github.com/Ryan-A-B/beddybytes/golang/internal/connections"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
)

var ErrDuplicate = errors.New("duplicate")

type Connection struct {
	ID        string
	AccountID string
	ClientID  string
	RequestID string
}

type ApplyFunc func(ctx context.Context, event *eventlog.Event) error

type Decider struct {
	eventLog             eventlog.EventLog
	cursor               int64
	mutex                sync.Mutex
	applyFuncByEventType map[string]ApplyFunc
	connectedKeySet      map[string]struct{}
	disconnectedKeySet   map[string]struct{}
}

type NewDeciderInput struct {
	EventLog eventlog.EventLog
}

func NewDecider(input NewDeciderInput) *Decider {
	decider := &Decider{
		eventLog:           input.EventLog,
		connectedKeySet:    make(map[string]struct{}),
		disconnectedKeySet: make(map[string]struct{}),
	}
	decider.applyFuncByEventType = map[string]ApplyFunc{
		connections.EventTypeConnected:    decider.applyConnected,
		connections.EventTypeDisconnected: decider.applyDisconnected,
	}
	return decider
}

func (decider *Decider) Put(ctx context.Context, connection Connection) error {
	decider.mutex.Lock()
	defer decider.mutex.Unlock()
	err := decider.catchUp(ctx)
	if err != nil {
		return err
	}
	connectionKey := decider.getKey(connection)
	_, found := decider.connectedKeySet[connectionKey]
	if found {
		return ErrDuplicate
	}
	data, err := json.Marshal(connections.EventConnected{
		ClientID:     connection.ClientID,
		ConnectionID: connection.ID,
		RequestID:    connection.RequestID,
	})
	fatal.OnError(err)
	_, err = decider.eventLog.Append(ctx, eventlog.AppendInput{
		Type:      connections.EventTypeConnected,
		AccountID: connection.AccountID,
		Data:      data,
	})
	return err
}

func (decider *Decider) Delete(ctx context.Context, connection Connection) error {
	decider.mutex.Lock()
	defer decider.mutex.Unlock()
	err := decider.catchUp(ctx)
	if err != nil {
		return err
	}
	connectionKey := decider.getKey(connection)
	_, found := decider.disconnectedKeySet[connectionKey]
	if found {
		return ErrDuplicate
	}
	data, err := json.Marshal(connections.EventDisconnected{
		ClientID:     connection.ClientID,
		ConnectionID: connection.ID,
		RequestID:    connection.RequestID,
	})
	fatal.OnError(err)
	_, err = decider.eventLog.Append(ctx, eventlog.AppendInput{
		Type:      connections.EventTypeDisconnected,
		AccountID: connection.AccountID,
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
		err := decider.apply(ctx, event)
		if err != nil {
			return err
		}
	}
	return iterator.Err()
}

func (decider *Decider) apply(ctx context.Context, event *eventlog.Event) error {
	apply, ok := decider.applyFuncByEventType[event.Type]
	if !ok {
		return nil
	}
	err := apply(ctx, event)
	if err != nil {
		return err
	}
	decider.cursor = event.LogicalClock
	return nil
}

func (decider *Decider) applyConnected(ctx context.Context, event *eventlog.Event) error {
	var data connections.EventConnected
	err := json.Unmarshal(event.Data, &data)
	fatal.OnError(err)
	connection := Connection{
		ID:        data.ConnectionID,
		AccountID: event.AccountID,
		ClientID:  data.ClientID,
		RequestID: data.RequestID,
	}
	key := decider.getKey(connection)
	decider.connectedKeySet[key] = struct{}{}
	return nil
}

func (decider *Decider) applyDisconnected(ctx context.Context, event *eventlog.Event) error {
	var data connections.EventDisconnected
	err := json.Unmarshal(event.Data, &data)
	fatal.OnError(err)
	connection := Connection{
		ID:        data.ConnectionID,
		AccountID: event.AccountID,
		ClientID:  data.ClientID,
		RequestID: data.RequestID,
	}
	key := decider.getKey(connection)
	decider.disconnectedKeySet[key] = struct{}{}
	return nil
}

func (decider *Decider) getKey(connection Connection) string {
	return fmt.Sprintf("accounts/%s/clients/%s/connections/%s/requests/%s", connection.AccountID, connection.ClientID, connection.ID, connection.RequestID)
}
