package future

import (
	"errors"
	"testing"
	"time"
)

func TestPromiseBroadcastsResultToAllFutures(t *testing.T) {
	promise := NewPromise[int]()
	wantErr := errors.New("shared result")
	first := promise.Future()
	select {
	case <-first.Ready():
		t.Fatal("unresolved promise is already ready")
	default:
	}
	type result struct {
		value int
		err   error
	}
	results := make(chan result, 8)
	for i := 0; i < cap(results); i++ {
		reader := promise.Future()
		go func() {
			<-reader.Ready()
			value, err := reader.Result()
			results <- result{value, err}
		}()
	}
	promise.Resolve(42, wantErr)
	deadline := time.NewTimer(5 * time.Second)
	defer deadline.Stop()
	for i := 0; i < cap(results); i++ {
		select {
		case got := <-results:
			if got.value != 42 || got.err != wantErr {
				t.Fatalf("reader got %+v, want 42 and shared error", got)
			}
		case <-deadline.C:
			t.Fatal("not all readers were notified")
		}
	}
	// A future obtained after resolution sees the same result immediately.
	late := promise.Future()
	select {
	case <-late.Ready():
		value, err := late.Result()
		if value != 42 || err != wantErr {
			t.Fatalf("late reader got %d, %v", value, err)
		}
	default:
		t.Fatal("late reader is not ready")
	}
}

func TestPromiseDoubleResolvePanicsWithoutChangingResult(t *testing.T) {
	promise := NewPromise[int]()
	promise.Resolve(1, nil)
	func() {
		defer func() {
			if recover() == nil {
				t.Error("second Resolve did not panic")
			}
		}()
		promise.Resolve(2, errors.New("second resolution"))
	}()
	value, err := promise.Future().Result()
	if value != 1 || err != nil {
		t.Fatalf("second Resolve changed the first result: %d, %v", value, err)
	}
}

func TestPromiseConcurrentResolveHasOneWinner(t *testing.T) {
	promise := NewPromise[int]()
	start := make(chan struct{})
	type outcome struct {
		value    int
		panicked bool
	}
	outcomes := make(chan outcome, 2)
	for _, value := range []int{1, 2} {
		go func() {
			panicked := true
			defer func() {
				_ = recover()
				outcomes <- outcome{value, panicked}
			}()
			<-start
			promise.Resolve(value, nil)
			panicked = false
		}()
	}
	close(start)
	var winners, winner int
	for i := 0; i < 2; i++ {
		result := <-outcomes
		if !result.panicked {
			winners++
			winner = result.value
		}
	}
	if winners != 1 {
		t.Fatalf("expected exactly one resolver to succeed, got %d", winners)
	}
	value, err := promise.Future().Result()
	if value != winner || err != nil {
		t.Fatalf("stored result %d, %v does not match winner %d", value, err, winner)
	}
}
