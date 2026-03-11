package main

import "sync"

type pendingSessionStart struct {
	connectionID string
	input        CreateSessionInput
}

type PendingSessionStarts struct {
	mutex            sync.Mutex
	entriesByAccount map[string][]pendingSessionStart
	maxPerAccount    int
}

func NewPendingSessionStarts() *PendingSessionStarts {
	return &PendingSessionStarts{
		entriesByAccount: make(map[string][]pendingSessionStart),
		maxPerAccount:    2,
	}
}

func (store *PendingSessionStarts) Put(accountID string, input CreateSessionInput) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	entries := store.entriesByAccount[accountID]
	entries = removeConnectionID(entries, input.ConnectionID)
	entries = append(entries, pendingSessionStart{
		connectionID: input.ConnectionID,
		input:        input,
	})
	if len(entries) > store.maxPerAccount {
		entries = entries[len(entries)-store.maxPerAccount:]
	}
	store.entriesByAccount[accountID] = entries
}

func (store *PendingSessionStarts) Take(accountID string, connectionID string) (CreateSessionInput, bool) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	entries := store.entriesByAccount[accountID]
	for i, pending := range entries {
		if pending.connectionID != connectionID {
			continue
		}
		store.entriesByAccount[accountID] = append(entries[:i], entries[i+1:]...)
		if len(store.entriesByAccount[accountID]) == 0 {
			delete(store.entriesByAccount, accountID)
		}
		return pending.input, true
	}
	return CreateSessionInput{}, false
}

func removeConnectionID(entries []pendingSessionStart, connectionID string) []pendingSessionStart {
	for i, entry := range entries {
		if entry.connectionID != connectionID {
			continue
		}
		return append(entries[:i], entries[i+1:]...)
	}
	return entries
}

func (store *PendingSessionStarts) lenForAccount(accountID string) int {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	return len(store.entriesByAccount[accountID])
}

func (store *PendingSessionStarts) contains(accountID string, connectionID string) bool {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	for _, entry := range store.entriesByAccount[accountID] {
		if entry.connectionID == connectionID {
			return true
		}
	}
	return false
}

func (store *PendingSessionStarts) connectionsInOrder(accountID string) []string {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	entries := store.entriesByAccount[accountID]
	out := make([]string, 0, len(entries))
	for _, entry := range entries {
		out = append(out, entry.connectionID)
	}
	return out
}
