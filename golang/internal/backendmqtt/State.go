package backendmqtt

import "sync"

type ConnectionInfo struct {
	ClientID     string
	ConnectionID string
	RequestID    string
}

type ConnectionRegistry struct {
	mutex                     sync.RWMutex
	connectionByAccountAndID  map[string]ConnectionInfo
	connectionByAccountClient map[string]ConnectionInfo
}

func NewConnectionRegistry() *ConnectionRegistry {
	return &ConnectionRegistry{
		connectionByAccountAndID:  make(map[string]ConnectionInfo),
		connectionByAccountClient: make(map[string]ConnectionInfo),
	}
}

func (registry *ConnectionRegistry) Put(accountID string, info ConnectionInfo) {
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	registry.connectionByAccountAndID[accountConnectionKey(accountID, info.ConnectionID)] = info
	registry.connectionByAccountClient[accountClientKey(accountID, info.ClientID)] = info
}

func (registry *ConnectionRegistry) Delete(accountID string, info ConnectionInfo) {
	registry.mutex.Lock()
	defer registry.mutex.Unlock()
	connectionKey := accountConnectionKey(accountID, info.ConnectionID)
	existing, ok := registry.connectionByAccountAndID[connectionKey]
	if ok && existing.RequestID == info.RequestID {
		delete(registry.connectionByAccountAndID, connectionKey)
	}
	clientKey := accountClientKey(accountID, info.ClientID)
	existing, ok = registry.connectionByAccountClient[clientKey]
	if ok && existing.RequestID == info.RequestID {
		delete(registry.connectionByAccountClient, clientKey)
	}
}

func (registry *ConnectionRegistry) GetByConnectionID(accountID string, connectionID string) (ConnectionInfo, bool) {
	registry.mutex.RLock()
	defer registry.mutex.RUnlock()
	info, ok := registry.connectionByAccountAndID[accountConnectionKey(accountID, connectionID)]
	return info, ok
}

func (registry *ConnectionRegistry) GetByClientID(accountID string, clientID string) (ConnectionInfo, bool) {
	registry.mutex.RLock()
	defer registry.mutex.RUnlock()
	info, ok := registry.connectionByAccountClient[accountClientKey(accountID, clientID)]
	return info, ok
}

type PendingSessionStarts struct {
	mutex sync.Mutex
	items map[string]PendingSessionStart
}

func NewPendingSessionStarts() *PendingSessionStarts {
	return &PendingSessionStarts{
		items: make(map[string]PendingSessionStart),
	}
}

func (store *PendingSessionStarts) Put(accountID string, pending PendingSessionStart) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	store.items[accountConnectionKey(accountID, pending.ConnectionID)] = pending
}

func (store *PendingSessionStarts) Get(accountID string, connectionID string) (PendingSessionStart, bool) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	key := accountConnectionKey(accountID, connectionID)
	pending, ok := store.items[key]
	if !ok {
		return PendingSessionStart{}, false
	}
	return pending, true
}

func (store *PendingSessionStarts) Delete(accountID string, connectionID string) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	delete(store.items, accountConnectionKey(accountID, connectionID))
}

func accountConnectionKey(accountID string, connectionID string) string {
	return accountID + "\x00" + connectionID
}

func accountClientKey(accountID string, clientID string) string {
	return accountID + "\x00" + clientID
}
