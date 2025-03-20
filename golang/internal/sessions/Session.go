package sessions

import "time"

type Session struct {
	AccountID        string    `json:"-"`
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	HostConnectionID string    `json:"host_connection_id"`
	StartedAt        time.Time `json:"started_at"`
}
