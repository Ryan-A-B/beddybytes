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
	"github.com/Ryan-A-B/beddybytes/golang/internal/events"
	"github.com/Ryan-A-B/beddybytes/golang/internal/models"
)

func TestLegacyAndGoogleCQRSReplayAndPasswordReset(t *testing.T) {
	ctx := context.Background()
	handlers, router, provider, log := googleTestHandlers(t)
	password := "original-long-password"
	hashed := models.NewHashedPassword(password)
	legacy := events.AccountCreatedV1Detail{AccountID: "legacy-account", User: events.UserV1{ID: "legacy-user", Email: "same@example.com", PasswordSalt: hashed.Salt, PasswordHash: hashed.Digest}}
	data, err := json.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := log.Append(ctx, eventlog.AppendInput{Type: events.TypeAccountCreatedV1, Data: data}); err != nil {
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
	passwordUser := models.UserID{Issuer: accountrepository.IssuerBeddybytes, Subject: legacy.User.Email}
	googleUser := models.UserID{Issuer: provider.identity.Issuer, Subject: provider.identity.Subject}
	googleAccountID := testAccountIDForUser(t, handlers, googleUser)
	newPassword := "new-password-long-enough"
	if err := handlers.AccountCommandHandler.ResetPassword(ctx, accountrepository.ResetPasswordInput{Email: legacy.User.Email, Password: newPassword}); err != nil {
		t.Fatal(err)
	}
	replayed := &Handlers{AccountQueryHandler: accountrepository.NewQueryHandler(accountrepository.NewQueryHandlerInput{EventLog: log})}
	legacyAccountID := testAccountIDForUser(t, replayed, passwordUser)
	if legacyAccountID != legacy.AccountID {
		t.Fatal("legacy account ID changed")
	}
	if err := replayed.AccountQueryHandler.CheckCredentials(ctx, accountrepository.CheckCredentialsInput{Email: legacy.User.Email, Password: newPassword}); err != nil {
		t.Fatal("reset password lost during replay", err)
	}
	if err := replayed.AccountQueryHandler.CheckCredentials(ctx, accountrepository.CheckCredentialsInput{Email: legacy.User.Email, Password: password}); !errors.Is(err, accountrepository.ErrInvalidPassword) {
		t.Fatal("old password accepted")
	}
	if id := testAccountIDForUser(t, replayed, googleUser); id != googleAccountID {
		t.Fatal("Google identity lost on replay")
	}
}

func TestIdentityUniquenessIsIssuerAndSubject(t *testing.T) {
	handlers, _, _, _ := googleTestHandlers(t)
	accountIDs := make(map[string]string)
	for _, issuer := range []string{"https://provider-one.example", "https://provider-two.example"} {
		accountIDs[issuer] = createTestAccount(t, handlers, accountrepository.CreateAccountInput{UserID: models.UserID{Issuer: issuer, Subject: "same-subject"}, Email: "shared@example.com"})
	}
	if accountIDs["https://provider-one.example"] == accountIDs["https://provider-two.example"] {
		t.Fatal("different issuers resolved to the same account")
	}
	_, err := handlers.AccountCommandHandler.CreateAccount(context.Background(), accountrepository.CreateAccountInput{UserID: models.UserID{Issuer: "https://provider-one.example", Subject: "same-subject"}, Email: "different@example.com"})
	if !errors.Is(err, accountrepository.ErrUserAlreadyExists) {
		t.Fatal("duplicate issuer/subject accepted", err)
	}
	for _, issuer := range []string{"https://provider-one.example", "https://provider-two.example"} {
		userID := models.UserID{Issuer: issuer, Subject: "same-subject"}
		if id := testAccountIDForUser(t, handlers, userID); id != accountIDs[issuer] {
			t.Fatal("wrong identity returned")
		}
	}
}
