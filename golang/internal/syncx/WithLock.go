package syncx

import "sync"

func WithLock(mutex *sync.Mutex, fn func()) {
	mutex.Lock()
	defer mutex.Unlock()
	fn()
}
