package sessionstore

import "github.com/Ryan-A-B/beddybytes/golang/internal/sessions"

type SessionStore interface {
	Put(session *sessions.Session)
	List(accountID string) []*sessions.Session
	Remove(accountID string, sessionID string)
}
