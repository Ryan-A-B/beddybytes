package accounts

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/ansel1/merry"

	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/golang/internal/store"
)

func TestLegacyAndGoogleReplayResetAndDurableDeletion(t *testing.T) {
	ctx := context.Background()
	handlers, router, provider, log := googleTestHandlers(t)
	legacy := &Account{ID: "legacy-account", User: NewUser(&NewUserInput{Email: "same@example.com", Password: "original-long-password"})}
	data, err := json.Marshal(struct {
		ID   string     `json:"id"`
		User LegacyUser `json:"user"`
	}{legacy.ID, LegacyUser{
		ID: legacy.User.ID, Email: legacy.User.InternalIdentity.Email,
		PasswordSalt: legacy.User.InternalIdentity.PasswordSalt,
		PasswordHash: legacy.User.InternalIdentity.PasswordHash,
	}})
	if err != nil {
		t.Fatal(err)
	}
	event, _ := log.Append(ctx, eventlog.AppendInput{Type: EventTypeAccountCreated, Data: data})
	handlers.ApplyEvent(ctx, event)
	login := httptest.NewRequest(http.MethodPost, "/token", strings.NewReader("grant_type=password&username=same%40example.com&password=original-long-password"))
	login.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	loginResult := httptest.NewRecorder()
	router.ServeHTTP(loginResult, login)
	if loginResult.Code != http.StatusOK {
		t.Fatalf("legacy password login failed: %d", loginResult.Code)
	}
	flow := beginGoogle(t, router, "signup")
	code := callbackValues(t, callbackGoogle(router, flow, "")).Get("code")
	w := exchangeBeddybytes(router, code, flow.verifier)
	var token AccessTokenOutput
	json.Unmarshal(w.Body.Bytes(), &token)
	googleAccount, err := handlers.AccountStore.GetByIdentity(ctx, provider.identity.Issuer, provider.identity.Subject)
	if err != nil {
		t.Fatal(err)
	}
	reset := PasswordResetData{Email: legacy.User.InternalIdentity.Email, PasswordSalt: []byte("salt"), PasswordHash: []byte("new-password-hash")}
	data, _ = json.Marshal(reset)
	event, _ = log.Append(ctx, eventlog.AppendInput{Type: EventTypeAccountPasswordReset, Data: data})
	handlers.ApplyEvent(ctx, event)
	r := httptest.NewRequest("DELETE", "/accounts/"+googleAccount.ID, nil)
	r.Header.Set("Authorization", "Bearer "+token.AccessToken)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatalf("delete failed: %d", w.Code)
	}
	if log.events[len(log.events)-1].Type != EventTypeAccountDeleted {
		t.Fatal("deletion was not recorded")
	}
	replayed := &Handlers{AccountStore: &AccountStore{Store: store.NewMemoryStore()}}
	for _, event := range log.events {
		replayed.ApplyEvent(ctx, event)
	}
	if _, err := replayed.AccountStore.GetByIdentity(ctx, provider.identity.Issuer, provider.identity.Subject); merry.HTTPCode(err) != 404 {
		t.Fatal("deleted Google identity resurrected")
	}
	account, err := replayed.AccountStore.GetByEmail(ctx, "same@example.com")
	if err != nil || account.ID != legacy.ID || string(account.User.InternalIdentity.PasswordHash) != "new-password-hash" {
		t.Fatal("Google deletion affected legacy account/reset replay")
	}
	issuer, subject := account.User.IdentityPair()
	account, err = replayed.AccountStore.GetByIdentity(ctx, issuer, subject)
	if err != nil || account.ID != legacy.ID {
		t.Fatal("legacy issuer/subject index not reconstructed")
	}
}

func TestIdentityUniquenessIsIssuerAndSubject(t *testing.T) {
	ctx := context.Background()
	accounts := &AccountStore{Store: store.NewMemoryStore()}
	for _, issuer := range []string{"https://provider-one.example", "https://provider-two.example"} {
		account := &Account{ID: issuer, User: &User{ID: issuer, IdentityType: IdentityTypeExternal, ExternalIdentity: &ExternalIdentity{Issuer: issuer, Subject: "same-subject", Email: "shared@example.com"}}}
		if err := accounts.Put(ctx, account); err != nil {
			t.Fatal("different issuers collided:", err)
		}
	}
	duplicate := &Account{ID: "duplicate", User: &User{ID: "duplicate", IdentityType: IdentityTypeExternal, ExternalIdentity: &ExternalIdentity{Issuer: "https://provider-one.example", Subject: "same-subject", Email: "different@example.com"}}}
	if err := accounts.Put(ctx, duplicate); merry.HTTPCode(err) != 409 {
		t.Fatal("same issuer/subject allowed twice")
	}
	for _, issuer := range []string{"https://provider-one.example", "https://provider-two.example"} {
		account, err := accounts.GetByIdentity(ctx, issuer, "same-subject")
		if err != nil || account.ID != issuer {
			t.Fatal("wrong issuer identity returned")
		}
	}
}
