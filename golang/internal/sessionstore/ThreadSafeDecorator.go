package sessionstore

import (
	"sync"

	"github.com/Ryan-A-B/beddybytes/golang/internal/sessions"
)

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

func (decorator *ThreadSafeDecorator) Put(session *sessions.Session) {
	decorator.mutex.Lock()
	defer decorator.mutex.Unlock()
	decorator.decorated.Put(session)
}

func (decorator *ThreadSafeDecorator) List(accountID string) []*sessions.Session {
	decorator.mutex.Lock()
	defer decorator.mutex.Unlock()
	return decorator.decorated.List(accountID)
}

func (decorator *ThreadSafeDecorator) Remove(accountID string, sessionID string) {
	decorator.mutex.Lock()
	defer decorator.mutex.Unlock()
	decorator.decorated.Remove(accountID, sessionID)
}
