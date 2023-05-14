package main

import (
	"log"
	"sync"
)

type PutClientInput struct {
	ID      string   `json:"id"`
	PeerIDs []string `json:"peer_ids"`
}

type ClientStore interface {
	Put(input PutClientInput) (client *Client)
	Get(clientID string) (client *Client)
	Remove(clientID string)
}

type ClientStoreInMemory struct {
	clients map[string]*Client
}

func (store *ClientStoreInMemory) Put(input PutClientInput) (client *Client) {
	client = &Client{
		ID:       input.ID,
		PeerIDs:  input.PeerIDs,
		messageC: make(chan []byte),
	}
	store.clients[input.ID] = client
	return
}

func (store *ClientStoreInMemory) Get(clientID string) (client *Client) {
	return store.clients[clientID]
}

func (store *ClientStoreInMemory) Remove(clientID string) {
	delete(store.clients, clientID)
}

type LockingDecorator struct {
	mutex     sync.RWMutex
	decorated ClientStore
}

func (store *LockingDecorator) Put(input PutClientInput) (client *Client) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	return store.decorated.Put(input)
}

func (store *LockingDecorator) Get(clientID string) (client *Client) {
	store.mutex.RLock()
	defer store.mutex.RUnlock()
	return store.decorated.Get(clientID)
}

func (store *LockingDecorator) Remove(clientID string) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	store.decorated.Remove(clientID)
}

type LoggingDecorator struct {
	decorated ClientStore
}

func (store *LoggingDecorator) Put(input PutClientInput) (client *Client) {
	log.Printf("putting client %s", input.ID)
	return store.decorated.Put(input)
}

func (store *LoggingDecorator) Get(clientID string) (client *Client) {
	log.Printf("getting client %s", clientID)
	return store.decorated.Get(clientID)
}

func (store *LoggingDecorator) Remove(clientID string) {
	log.Printf("removing client %s", clientID)
	store.decorated.Remove(clientID)
}
