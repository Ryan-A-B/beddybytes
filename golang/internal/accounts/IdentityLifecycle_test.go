package accounts

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Ryan-A-B/beddybytes/golang/internal/accountrepository"
	"github.com/Ryan-A-B/beddybytes/golang/internal/eventlog"
)

func TestLegacyAndGoogleCQRSReplayAndPasswordReset(t *testing.T) {
	ctx := context.Background()
	handlers, router, provider, log := googleTestHandlers(t)
	password := "original-long-password"
	hashed := accountrepository.NewHashedPassword(password)
	legacy := accountrepository.AccountCreatedV1Detail{AccountID: "legacy-account", User: accountrepository.UserV1{ID: "legacy-user", Email: "same@example.com", PasswordSalt: hashed.Salt, PasswordHash: hashed.Hash}}
	data, err := json.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := log.Append(ctx, eventlog.AppendInput{Type: accountrepository.EventTypeAccountCreatedV1, Data: data}); err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/token", strings.NewReader("grant_type=password&username=same%40example.com&password="+password))
	request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("legacy password login: %d %s", response.Code, response.Body.String())
	}
	flow := beginGoogle(t, router, "signup")
	code := callbackValues(t, callbackGoogle(router, flow, "")).Get("code")
	if response := exchangeBeddybytes(router, code, flow.verifier); response.Code != http.StatusOK {
		t.Fatalf("Google code exchange: %d", response.Code)
	}
	passwordUser := accountrepository.UserID{Issuer: accountrepository.IssuerBeddybytes, Subject: legacy.User.Email}
	googleUser := accountrepository.UserID{Issuer: provider.identity.Issuer, Subject: provider.identity.Subject}
	googleAccount := testAccountForUser(t, handlers, googleUser)
	newPassword := "new-password-long-enough"
	if err := handlers.AccountCommandHandler.ResetPassword(ctx, accountrepository.ResetPasswordInput{Email: legacy.User.Email, Password: newPassword}); err != nil {
		t.Fatal(err)
	}
	replayed := &Handlers{AccountQueryHandler: accountrepository.NewQueryHandler(accountrepository.NewQueryHandlerInput{EventLog: log})}
	legacyAccount := testAccountForUser(t, replayed, passwordUser)
	if legacyAccount.ID != legacy.AccountID {
		t.Fatal("legacy account ID changed")
	}
	if err := replayed.AccountQueryHandler.CheckCredentials(ctx, accountrepository.CheckCredentialsInput{Email: legacy.User.Email, Password: newPassword}); err != nil {
		t.Fatal("reset password lost during replay", err)
	}
	if err := replayed.AccountQueryHandler.CheckCredentials(ctx, accountrepository.CheckCredentialsInput{Email: legacy.User.Email, Password: password}); !errors.Is(err, accountrepository.ErrInvalidPassword) {
		t.Fatal("old password accepted")
	}
	if account := testAccountForUser(t, replayed, googleUser); account.ID != googleAccount.ID || account.Users[0].ID != googleUser || account.Users[0].Email != "same@example.com" || account.Users[0].HashedPassword != nil {
		t.Fatal("Google identity lost on replay")
	}
}

func TestIdentityUniquenessIsIssuerAndSubject(t *testing.T) {
	handlers, _, _, _ := googleTestHandlers(t)
	for _, issuer := range []string{"https://provider-one.example", "https://provider-two.example"} {
		createTestAccount(t, handlers, accountrepository.CreateInput{UserID: accountrepository.UserID{Issuer: issuer, Subject: "same-subject"}, Email: "shared@example.com"})
	}
	_, err := handlers.AccountCommandHandler.Create(context.Background(), accountrepository.CreateInput{UserID: accountrepository.UserID{Issuer: "https://provider-one.example", Subject: "same-subject"}, Email: "different@example.com"})
	if !errors.Is(err, accountrepository.ErrUserAlreadyExists) {
		t.Fatal("duplicate issuer/subject accepted", err)
	}
	for _, issuer := range []string{"https://provider-one.example", "https://provider-two.example"} {
		userID := accountrepository.UserID{Issuer: issuer, Subject: "same-subject"}
		if account := testAccountForUser(t, handlers, userID); account.Users[0].ID != userID {
			t.Fatal("wrong identity returned")
		}
	}
}
