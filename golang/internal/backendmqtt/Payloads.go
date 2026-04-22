package backendmqtt

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/Ryan-A-B/beddybytes/golang/internal/sessions"
)

const (
	ClientStatusTypeConnected    = "connected"
	ClientStatusTypeDisconnected = "disconnected"
	AnnouncementType             = "announcement"
)

type DisconnectReason string

const (
	DisconnectReasonClean      DisconnectReason = "clean"
	DisconnectReasonUnexpected DisconnectReason = "unexpected"
)

type ClientStatusPayload struct {
	Type         string                     `json:"type"`
	ConnectionID string                     `json:"connection_id"`
	RequestID    string                     `json:"request_id"`
	AtMillis     int64                      `json:"at_millis"`
	Disconnected *ClientStatusDisconnected  `json:"disconnected,omitempty"`
}

type ClientStatusDisconnected struct {
	Reason DisconnectReason `json:"reason"`
}

type WebRTCInboxPayload struct {
	FromClientID string          `json:"from_client_id"`
	Description  json.RawMessage `json:"description,omitempty"`
	Candidate    json.RawMessage `json:"candidate,omitempty"`
}

func NewWebRTCInboxPayload(fromClientID string, signalData json.RawMessage) WebRTCInboxPayload {
	payload := WebRTCInboxPayload{
		FromClientID: fromClientID,
	}
	var probe struct {
		Type      string          `json:"type"`
		Candidate json.RawMessage `json:"candidate"`
	}
	if err := json.Unmarshal(signalData, &probe); err == nil {
		switch probe.Type {
		case "offer", "answer":
			payload.Description = signalData
			return payload
		}
		if probe.Candidate != nil {
			payload.Candidate = signalData
			return payload
		}
	}
	payload.Candidate = signalData
	return payload
}

func (payload WebRTCInboxPayload) SignalData() json.RawMessage {
	if payload.Description != nil {
		return payload.Description
	}
	return payload.Candidate
}

type BabyStationsPayload struct {
	Type         string              `json:"type"`
	AtMillis     int64               `json:"at_millis"`
	Announcement SessionAnnouncement `json:"announcement"`
}

type SessionAnnouncement struct {
	ClientID        string `json:"client_id"`
	ConnectionID    string `json:"connection_id"`
	SessionID       string `json:"session_id"`
	Name            string `json:"name"`
	StartedAtMillis int64  `json:"started_at_millis"`
}

type ParentStationsPayload struct {
	Type         string                    `json:"type"`
	AtMillis     int64                     `json:"at_millis"`
	Announcement ParentStationAnnouncement `json:"announcement"`
}

type ParentStationAnnouncement struct {
	ClientID     string `json:"client_id"`
	ConnectionID string `json:"connection_id"`
}

type ControlInboxPayload struct {
	Type                    string               `json:"type"`
	AtMillis                int64                `json:"at_millis"`
	BabyStationAnnouncement *SessionAnnouncement `json:"baby_station_announcement,omitempty"`
}

type PendingSessionStart struct {
	SessionID    string
	Name         string
	ConnectionID string
	StartedAt    time.Time
}

func (payload BabyStationsPayload) Session() sessions.Session {
	return sessions.Session{
		ID:               payload.Announcement.SessionID,
		Name:             payload.Announcement.Name,
		HostConnectionID: payload.Announcement.ConnectionID,
		StartedAt:        time.UnixMilli(payload.Announcement.StartedAtMillis),
	}
}

func (pending PendingSessionStart) Validate() error {
	if pending.SessionID == "" {
		return errors.New("session id is empty")
	}
	if pending.Name == "" {
		return errors.New("session name is empty")
	}
	if pending.ConnectionID == "" {
		return errors.New("connection id is empty")
	}
	return nil
}
