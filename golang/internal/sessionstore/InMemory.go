package sessionstore

import (
	"sort"

	"github.com/Ryan-A-B/beddybytes/golang/internal/sessions"
)

type InMemory struct {
	sessions []*sessions.Session
}

func (store *InMemory) Put(session *sessions.Session) {
	index := store.search(session.AccountID, session.ID)
	if index == len(store.sessions) {
		store.sessions = append(store.sessions, session)
		return
	}
	other := store.sessions[index]
	same := other.AccountID == session.AccountID && other.ID == session.ID
	if same {
		return
	}
	store.sessions = append(store.sessions, nil)
	copy(store.sessions[index+1:], store.sessions[index:])
	store.sessions[index] = session
}

func (store *InMemory) List(accountID string) (sessions []*sessions.Session) {
	index := sort.Search(len(store.sessions), func(i int) bool {
		session := store.sessions[i]
		return session.AccountID >= accountID
	})
	if index == len(store.sessions) {
		return
	}
	for _, session := range store.sessions[index:] {
		if session.AccountID != accountID {
			break
		}
		sessions = append(sessions, session)
	}
	return
}

func (store *InMemory) Remove(accountID string, sessionID string) {
	index := store.search(accountID, sessionID)
	if index == len(store.sessions) {
		return
	}
	other := store.sessions[index]
	same := other.AccountID == accountID && other.ID == sessionID
	if !same {
		return
	}
	store.sessions = append(store.sessions[:index], store.sessions[index+1:]...)
}

func (store *InMemory) search(accountID string, sessionID string) int {
	return sort.Search(len(store.sessions), func(i int) bool {
		other := store.sessions[i]
		if accountID < other.AccountID {
			return true
		}
		if accountID != other.AccountID {
			return false
		}
		if sessionID <= other.ID {
			return true
		}
		return false
	})
}
