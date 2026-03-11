package main

import "testing"

func TestPendingSessionStartsLRUPerAccount(t *testing.T) {
	store := NewPendingSessionStarts()
	accountID := "account-1"

	store.Put(accountID, CreateSessionInput{ConnectionID: "c1", Name: "one", StartedAtMillis: 1})
	store.Put(accountID, CreateSessionInput{ConnectionID: "c2", Name: "two", StartedAtMillis: 2})
	store.Put(accountID, CreateSessionInput{ConnectionID: "c3", Name: "three", StartedAtMillis: 3})

	if store.contains(accountID, "c1") {
		t.Fatalf("expected oldest entry c1 to be evicted")
	}
	if !store.contains(accountID, "c2") || !store.contains(accountID, "c3") {
		t.Fatalf("expected c2 and c3 to be retained")
	}
	order := store.connectionsInOrder(accountID)
	if len(order) != 2 || order[0] != "c2" || order[1] != "c3" {
		t.Fatalf("unexpected order: %#v", order)
	}
}

func TestPendingSessionStartsTakeAndPromote(t *testing.T) {
	store := NewPendingSessionStarts()
	accountID := "account-1"

	store.Put(accountID, CreateSessionInput{ConnectionID: "c1", Name: "one", StartedAtMillis: 1})
	store.Put(accountID, CreateSessionInput{ConnectionID: "c2", Name: "two", StartedAtMillis: 2})
	store.Put(accountID, CreateSessionInput{ConnectionID: "c1", Name: "one-new", StartedAtMillis: 3})

	order := store.connectionsInOrder(accountID)
	if len(order) != 2 || order[0] != "c2" || order[1] != "c1" {
		t.Fatalf("unexpected order after promote: %#v", order)
	}

	input, ok := store.Take(accountID, "c1")
	if !ok {
		t.Fatalf("expected c1 to be present")
	}
	if input.Name != "one-new" {
		t.Fatalf("unexpected input returned: %#v", input)
	}
	if store.lenForAccount(accountID) != 1 {
		t.Fatalf("expected one entry remaining")
	}
}

func TestPendingSessionStartsIsolatedByAccount(t *testing.T) {
	store := NewPendingSessionStarts()
	store.Put("a1", CreateSessionInput{ConnectionID: "c1", Name: "one", StartedAtMillis: 1})
	store.Put("a2", CreateSessionInput{ConnectionID: "c1", Name: "other", StartedAtMillis: 1})

	_, okA1 := store.Take("a1", "c1")
	_, okA2 := store.Take("a2", "c1")
	if !okA1 || !okA2 {
		t.Fatalf("expected both accounts to have isolated entries")
	}
}
