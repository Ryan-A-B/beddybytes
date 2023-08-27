package main

import (
	"fmt"
	"sort"
	"sync"
)

type SessionStore interface {
	Put(session *Session)
	List(accountID string) []*Session
	Remove(accountID string, sessionID string)
}

type SessionStoreInMemory struct {
	sessions []*Session
}

func (store *SessionStoreInMemory) Put(session *Session) {
	index := store.search(session.AccountID, session.ID)
	fmt.Println(index, len(store.sessions))
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

func (store *SessionStoreInMemory) List(accountID string) (sessions []*Session) {
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

func (store *SessionStoreInMemory) Remove(accountID string, sessionID string) {
	index := store.search(accountID, sessionID)
	fmt.Println(index, len(store.sessions))
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

func (store *SessionStoreInMemory) search(accountID string, sessionID string) int {
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

type ThreadSafeDecorator struct {
	mutex     sync.Mutex
	decorated SessionStore
}

type NewThreadSafeDecoratorInput struct {
	Decorated SessionStore
}

func NewThreadSafeDecorator(input *NewThreadSafeDecoratorInput) *ThreadSafeDecorator {
	return &ThreadSafeDecorator{
		decorated: input.Decorated,
	}
}

func (decorator *ThreadSafeDecorator) Put(session *Session) {
	decorator.mutex.Lock()
	defer decorator.mutex.Unlock()
	decorator.decorated.Put(session)
}

func (decorator *ThreadSafeDecorator) List(accountID string) []*Session {
	decorator.mutex.Lock()
	defer decorator.mutex.Unlock()
	return decorator.decorated.List(accountID)
}

func (decorator *ThreadSafeDecorator) Remove(accountID string, sessionID string) {
	decorator.mutex.Lock()
	defer decorator.mutex.Unlock()
	decorator.decorated.Remove(accountID, sessionID)
}
