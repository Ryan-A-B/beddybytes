package accounts

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"io"
	"net/http"

	"github.com/ansel1/merry"

	"github.com/Ryan-A-B/beddybytes/backend/internal/store"
	"github.com/Ryan-A-B/beddybytes/internal/fatal"
)

type AccountStore struct {
	Store store.Store
}

func (store *AccountStore) Put(ctx context.Context, account *Account) (err error) {
	existingAccount, err := store.Get(ctx, account.ID)
	if merry.HTTPCode(err) == http.StatusOK {
		return store.update(ctx, existingAccount, account)
	}
	return store.create(ctx, account)
}

func (store *AccountStore) create(ctx context.Context, account *Account) (err error) {
	err = store.checkEmail(ctx, account.User.Email)
	if err != nil {
		return
	}
	store.write(ctx, account)
	return
}

func (store *AccountStore) update(ctx context.Context, existingAccount *Account, account *Account) (err error) {
	if existingAccount.User.Email != account.User.Email {
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
	err = store.Store.Put(ctx, account.User.Email, data)
	fatal.OnError(err)
}

func (store *AccountStore) Get(ctx context.Context, accountID string) (account *Account, err error) {
	return store.get(ctx, accountID)
}

func (store *AccountStore) GetByEmail(ctx context.Context, email string) (account *Account, err error) {
	return store.get(ctx, email)
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
	account, err := store.Get(ctx, accountID)
	if err != nil {
		return
	}
	err = store.Store.Delete(ctx, accountID)
	fatal.OnError(err)
	err = store.Store.Delete(ctx, account.User.Email)
	fatal.OnError(err)
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
	account, err := store.GetByEmail(ctx, input.Email)
	if err != nil {
		return
	}
	account.User.PasswordSalt = input.PasswordSalt
	account.User.PasswordHash = input.PasswordHash
	data, err := json.Marshal(account)
	if err != nil {
		return
	}
	err = store.Store.Put(ctx, account.ID, data)
	fatal.OnError(err)
	err = store.Store.Put(ctx, account.User.Email, data)
	fatal.OnError(err)
	return nil
}
