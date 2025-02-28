package main

import (
	"context"
	"log"
	"sync"

	"github.com/Ryan-A-B/beddybytes/golang/internal"
)

type PutClientInput struct {
	ID    string     `json:"id"`
	Type  ClientType `json:"type"`
	Alias string     `json:"alias"`
}

type ClientStore interface {
	Put(ctx context.Context, input PutClientInput) (client *Client)
	List(ctx context.Context) (clients []*Client)
	Get(ctx context.Context, clientID string) (client *Client)
	Remove(ctx context.Context, clientID string)
}

type ClientStoreInMemory struct {
	clientsByAccountID map[string]map[string]*Client
}

func (store *ClientStoreInMemory) getClientsByAccountID(accountID string) (clients map[string]*Client) {
	clients = store.clientsByAccountID[accountID]
	if clients == nil {
		clients = make(map[string]*Client)
		store.clientsByAccountID[accountID] = clients
	}
	return
}

func (store *ClientStoreInMemory) Put(ctx context.Context, input PutClientInput) (client *Client) {
	accountID := internal.GetAccountIDFromContext(ctx)
	clients := store.getClientsByAccountID(accountID)
	client = &Client{
		ID:       input.ID,
		Type:     input.Type,
		Alias:    input.Alias,
		messageC: make(chan []byte),
	}
	clients[input.ID] = client
	return
}

func (store *ClientStoreInMemory) List(ctx context.Context) (clientSlice []*Client) {
	accountID := internal.GetAccountIDFromContext(ctx)
	clients := store.getClientsByAccountID(accountID)
	for _, client := range clients {
		clientSlice = append(clientSlice, client)
	}
	return
}

func (store *ClientStoreInMemory) Get(ctx context.Context, clientID string) (client *Client) {
	accountID := internal.GetAccountIDFromContext(ctx)
	clients := store.getClientsByAccountID(accountID)
	return clients[clientID]
}

func (store *ClientStoreInMemory) Remove(ctx context.Context, clientID string) {
	accountID := internal.GetAccountIDFromContext(ctx)
	clients := store.getClientsByAccountID(accountID)
	delete(clients, clientID)
	if len(clients) == 0 {
		delete(store.clientsByAccountID, accountID)
	}
}

type LockingDecorator struct {
	mutex     sync.RWMutex
	decorated ClientStore
}

func (store *LockingDecorator) Put(ctx context.Context, input PutClientInput) (client *Client) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	return store.decorated.Put(ctx, input)
}

func (store *LockingDecorator) List(ctx context.Context) (clients []*Client) {
	store.mutex.RLock()
	defer store.mutex.RUnlock()
	return store.decorated.List(ctx)
}

func (store *LockingDecorator) Get(ctx context.Context, clientID string) (client *Client) {
	store.mutex.RLock()
	defer store.mutex.RUnlock()
	return store.decorated.Get(ctx, clientID)
}

func (store *LockingDecorator) Remove(ctx context.Context, clientID string) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	store.decorated.Remove(ctx, clientID)
}

type LoggingDecorator struct {
	decorated ClientStore
}

func (store *LoggingDecorator) Put(ctx context.Context, input PutClientInput) (client *Client) {
	accountID := internal.GetAccountIDFromContext(ctx)
	log.Printf("putting client %s for %s", input.ID, accountID)
	return store.decorated.Put(ctx, input)
}

func (store *LoggingDecorator) List(ctx context.Context) (clients []*Client) {
	accountID := internal.GetAccountIDFromContext(ctx)
	log.Printf("listing clients for %s", accountID)
	return store.decorated.List(ctx)
}

func (store *LoggingDecorator) Get(ctx context.Context, clientID string) (client *Client) {
	accountID := internal.GetAccountIDFromContext(ctx)
	log.Printf("getting client %s for %s", clientID, accountID)
	return store.decorated.Get(ctx, clientID)
}

func (store *LoggingDecorator) Remove(ctx context.Context, clientID string) {
	accountID := internal.GetAccountIDFromContext(ctx)
	log.Printf("removing client %s for %s", clientID, accountID)
	store.decorated.Remove(ctx, clientID)
}
