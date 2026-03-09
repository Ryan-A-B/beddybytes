package main

import "sync"

type ConnectionHub struct {
	mutex          sync.RWMutex
	connectionByID map[string]*Connection
}

func NewConnectionHub() *ConnectionHub {
	return &ConnectionHub{
		connectionByID: make(map[string]*Connection),
	}
}

func (hub *ConnectionHub) Put(connection *Connection) {
	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	hub.connectionByID[connection.ID] = connection
}

func (hub *ConnectionHub) Delete(connectionID string) {
	hub.mutex.Lock()
	defer hub.mutex.Unlock()
	delete(hub.connectionByID, connectionID)
}

func (hub *ConnectionHub) Get(connectionID string) (*Connection, bool) {
	hub.mutex.RLock()
	defer hub.mutex.RUnlock()
	connection, ok := hub.connectionByID[connectionID]
	return connection, ok
}
