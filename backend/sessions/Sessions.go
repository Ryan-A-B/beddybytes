package sessions

import (
	"context"

	uuid "github.com/satori/go.uuid"

	"github.com/Ryan-A-B/baby-monitor/backend/internal/eventlog"
	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
)

const EventTypeSessionStarted = "session.start"
const EventTypeSessionEnded = "session.end"

type Sessions struct {
	log eventlog.EventLog
}

type Session struct {
	ID           string `json:"id"`
	HostClientID string `json:"host_client_id"`
	StartedAt    int64  `json:"started_at"`
}

type SessionStarted struct {
	SessionID    string `json:"session_id"`
	HostClientID string `json:"host_client_id"`
}

type SessionEnded struct {
	SessionID string `json:"session_id"`
}

type CreateSessionInput struct {
	HostClientID string
}

func (sessions *Sessions) StartSession(ctx context.Context, input *CreateSessionInput) *Session {
	payload := SessionStarted{
		SessionID:    uuid.NewV4().String(),
		HostClientID: input.HostClientID,
	}
	event, err := sessions.log.Append(ctx, &eventlog.AppendInput{
		Type: EventTypeSessionStarted,
		Data: fatal.UnlessMarshalJSON(&payload),
	})
	fatal.OnError(err)
	return CreateSessionFromSessionStartedEvent(event)
}

func (sessions *Sessions) EndSession(ctx context.Context, sessionID string) {
	_, err := sessions.log.Append(ctx, &eventlog.AppendInput{
		Type: EventTypeSessionEnded,
		Data: fatal.UnlessMarshalJSON(SessionEnded{
			SessionID: sessionID,
		}),
	})
	fatal.OnError(err)
}

func CreateSessionFromSessionStartedEvent(event *eventlog.Event) *Session {
	fatal.Unless(event.Type == EventTypeSessionStarted, "event type is not session.start")
	var payload SessionStarted
	fatal.UnlessUnmarshalJSON(event.Data, &payload)
	return &Session{
		ID:           payload.SessionID,
		HostClientID: payload.HostClientID,
		StartedAt:    event.UnixTimestamp,
	}
}
