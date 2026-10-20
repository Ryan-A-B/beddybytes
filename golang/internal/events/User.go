package events

import (
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
)

const (
	TypeUserPasswordReset eventlog.EventType = "user.password_reset"
)

type UserPasswordResetDetail struct {
	Email          string                `json:"email"`
	HashedPassword models.HashedPassword `json:"hashed_password"`
}
