package backendmqtt

import (
	"context"
	"sync"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/connections"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/logx"
)

type ReconnectTimeoutScheduler struct {
	eventLog eventlog.EventLog
	retain   time.Duration

	mutex            sync.Mutex
	timerByClientKey map[string]reconnectTimeoutTimer
}

type NewReconnectTimeoutSchedulerInput struct {
	EventLog eventlog.EventLog
	Retain   time.Duration
}

type reconnectTimeoutTimer struct {
	cancel       context.CancelFunc
	connectionID string
	requestID    string
}

func NewReconnectTimeoutScheduler(input NewReconnectTimeoutSchedulerInput) *ReconnectTimeoutScheduler {
	retain := input.Retain
	if retain == 0 {
		retain = 4 * time.Hour
	}
	return &ReconnectTimeoutScheduler{
		eventLog:         input.EventLog,
		retain:           retain,
		timerByClientKey: make(map[string]reconnectTimeoutTimer),
	}
}

func (scheduler *ReconnectTimeoutScheduler) CancelClient(accountID string, clientID string) {
	scheduler.mutex.Lock()
	defer scheduler.mutex.Unlock()
	scheduler.cancelClientLocked(accountID, clientID)
}

func (scheduler *ReconnectTimeoutScheduler) cancelClientLocked(accountID string, clientID string) {
	key := accountClientKey(accountID, clientID)
	timer, ok := scheduler.timerByClientKey[key]
	if !ok {
		return
	}
	timer.cancel()
	delete(scheduler.timerByClientKey, key)
}

func (scheduler *ReconnectTimeoutScheduler) Schedule(accountID string, clientID string, connectionID string, requestID string) {
	scheduler.mutex.Lock()
	defer scheduler.mutex.Unlock()
	scheduler.cancelClientLocked(accountID, clientID)
	ctx, cancel := context.WithCancel(context.Background())
	key := accountClientKey(accountID, clientID)
	scheduler.timerByClientKey[key] = reconnectTimeoutTimer{
		cancel:       cancel,
		connectionID: connectionID,
		requestID:    requestID,
	}

	go scheduler.publishReconnectTimeout(ctx, accountID, clientID, connectionID, requestID)
}

func (scheduler *ReconnectTimeoutScheduler) publishReconnectTimeout(ctx context.Context, accountID string, clientID string, connectionID string, requestID string) {
	waitTimer := time.NewTimer(scheduler.retain)
	defer waitTimer.Stop()
	select {
	case <-ctx.Done():
		return
	case <-waitTimer.C:
	}

	scheduler.mutex.Lock()
	defer scheduler.mutex.Unlock()

	key := accountClientKey(accountID, clientID)
	registeredTimer, ok := scheduler.timerByClientKey[key]
	if !ok || registeredTimer.connectionID != connectionID || registeredTimer.requestID != requestID {
		return
	}
	registeredTimer.cancel()
	delete(scheduler.timerByClientKey, key)

	_, err := scheduler.eventLog.Append(context.Background(), eventlog.AppendInput{
		Type:      connections.EventTypeReconnectTimeout,
		AccountID: accountID,
		Data: fatal.UnlessMarshalJSON(connections.EventReconnectTimeout{
			ClientID:     clientID,
			ConnectionID: connectionID,
			RequestID:    requestID,
		}),
	})
	if err != nil {
		logx.Errorln(err)
	}
}
