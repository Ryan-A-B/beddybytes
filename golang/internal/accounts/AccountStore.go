package accounts

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"sync"

	"github.com/ansel1/merry"

	"github.com/Ryan-A-B/beddybytes/golang/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/golang/internal/store"
)

type AccountStore struct {
	Store store.Store
	mutex sync.Mutex
}

func (store *AccountStore) Put(ctx context.Context, account *Account) (err error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	return store.put(ctx, account)
}

func (store *AccountStore) put(ctx context.Context, account *Account) (err error) {
	existingAccount, err := store.get(ctx, account.ID)
	if merry.HTTPCode(err) == http.StatusOK {
		return store.update(ctx, existingAccount, account)
	}
	if merry.HTTPCode(err) != http.StatusNotFound {
		return err
	}
	return store.create(ctx, account)
}

func (store *AccountStore) create(ctx context.Context, account *Account) (err error) {
	err = store.checkIdentity(ctx, account)
	if err != nil {
		return
	}
	store.write(ctx, account)
	return
}

func (store *AccountStore) update(ctx context.Context, existingAccount *Account, account *Account) (err error) {
	oldIssuer, oldSubject := existingAccount.User.Identity()
	issuer, subject := account.User.Identity()
	if oldIssuer != issuer || oldSubject != subject {
		return merry.New("account identity cannot change").WithHTTPCode(http.StatusBadRequest)
	}
	if account.User.IsPasswordUser() && existingAccount.User.Email != account.User.Email {
		err = store.checkEmail(ctx, account.User.Email)
		if err != nil {
			return
		}
		err = store.Store.Delete(ctx, existingAccount.User.Email)
		fatal.OnError(err)
	}
	store.write(ctx, account)
	return
}

func identityKey(issuer, subject string) string {
	digest := sha256.Sum256([]byte(issuer + "\x00" + subject))
	return "identity:" + base64.RawURLEncoding.EncodeToString(digest[:])
}

func (store *AccountStore) checkIdentity(ctx context.Context, account *Account) error {
	issuer, subject := account.User.Identity()
	if subject == "" {
		return merry.New("identity subject is required").WithHTTPCode(http.StatusBadRequest)
	}
	if _, err := store.get(ctx, identityKey(issuer, subject)); err == nil {
		return merry.New("identity already in use").WithHTTPCode(http.StatusConflict)
	} else if merry.HTTPCode(err) != http.StatusNotFound {
		return err
	}
	if account.User.IsPasswordUser() {
		return store.checkEmail(ctx, account.User.Email)
	}
	return nil
}

// Append the durable event and update its projection while holding the same
// lock as identity checks. Replay remains idempotent, and parallel callbacks
// cannot create two accounts for one identity in this single-process backend.
func (store *AccountStore) Create(ctx context.Context, account *Account, appendEvent func() error) error {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	if err := store.checkIdentity(ctx, account); err != nil {
		return err
	}
	if err := appendEvent(); err != nil {
		return err
	}
	store.write(ctx, account)
	return nil
}

func (store *AccountStore) checkEmail(ctx context.Context, email string) (err error) {
	_, err = store.Store.Get(ctx, email)
	if err == nil {
		err = merry.New("email already in use").WithHTTPCode(http.StatusBadRequest)
		return
	}
	fatal.Unless(merry.HTTPCode(err) == http.StatusNotFound, "unexpected error")
	err = nil
	return
}

func (store *AccountStore) write(ctx context.Context, account *Account) {
	data, err := json.Marshal(account)
	fatal.OnError(err)
	err = store.Store.Put(ctx, account.ID, data)
	fatal.OnError(err)
	issuer, subject := account.User.Identity()
	err = store.Store.Put(ctx, identityKey(issuer, subject), data)
	fatal.OnError(err)
	if account.User.IsPasswordUser() {
		err = store.Store.Put(ctx, account.User.Email, data)
		fatal.OnError(err)
	}
}

func (store *AccountStore) Get(ctx context.Context, accountID string) (account *Account, err error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	return store.get(ctx, accountID)
}

func (store *AccountStore) GetByEmail(ctx context.Context, email string) (account *Account, err error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	account, err = store.get(ctx, email)
	if err == nil && !account.User.IsPasswordUser() {
		return nil, merry.New("password account not found").WithHTTPCode(http.StatusNotFound)
	}
	return
}

func (store *AccountStore) GetByIdentity(ctx context.Context, issuer, subject string) (*Account, error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	return store.get(ctx, identityKey(issuer, subject))
}

func (store *AccountStore) get(ctx context.Context, key string) (account *Account, err error) {
	data, err := store.Store.Get(ctx, key)
	if err != nil {
		return
	}
	account = new(Account)
	err = json.Unmarshal(data, account)
	fatal.OnError(err)
	return
}

func (store *AccountStore) Remove(ctx context.Context, accountID string) (err error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	return store.remove(ctx, accountID)
}

func (store *AccountStore) Delete(ctx context.Context, accountID string, appendEvent func() error) error {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	if _, err := store.get(ctx, accountID); err != nil {
		return err
	}
	if err := appendEvent(); err != nil {
		return err
	}
	return store.remove(ctx, accountID)
}

func (store *AccountStore) remove(ctx context.Context, accountID string) (err error) {
	account, err := store.get(ctx, accountID)
	if err != nil {
		return
	}
	err = store.Store.Delete(ctx, accountID)
	fatal.OnError(err)
	issuer, subject := account.User.Identity()
	err = store.Store.Delete(ctx, identityKey(issuer, subject))
	fatal.OnError(err)
	if account.User.IsPasswordUser() {
		err = store.Store.Delete(ctx, account.User.Email)
		fatal.OnError(err)
	}
	return
}

func calculatePasswordHash(password string, salt []byte) (passwordHash []byte) {
	var err error
	hash := sha256.New()
	_, err = hash.Write(salt)
	fatal.OnError(err)
	_, err = io.WriteString(hash, password)
	fatal.OnError(err)
	passwordHash = hash.Sum(nil)
	return
}

type UpdatePasswordInput struct {
	Email        string
	PasswordSalt []byte
	PasswordHash []byte
}

func (store *AccountStore) UpdatePassword(ctx context.Context, input *UpdatePasswordInput) (err error) {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	return store.updatePassword(ctx, input)
}

func (store *AccountStore) SetPassword(ctx context.Context, input *UpdatePasswordInput, appendEvent func() error) error {
	store.mutex.Lock()
	defer store.mutex.Unlock()
	account, err := store.get(ctx, input.Email)
	if err != nil {
		return err
	}
	if !account.User.IsPasswordUser() {
		return merry.New("password account not found").WithHTTPCode(http.StatusNotFound)
	}
	if err := appendEvent(); err != nil {
		return err
	}
	return store.updatePassword(ctx, input)
}

func (store *AccountStore) updatePassword(ctx context.Context, input *UpdatePasswordInput) (err error) {
	account, err := store.get(ctx, input.Email)
	if err != nil {
		return
	}
	if !account.User.IsPasswordUser() {
		return merry.New("password account not found").WithHTTPCode(http.StatusNotFound)
	}
	account.User.PasswordSalt = input.PasswordSalt
	account.User.PasswordHash = input.PasswordHash
	store.write(ctx, account)
	return nil
}
