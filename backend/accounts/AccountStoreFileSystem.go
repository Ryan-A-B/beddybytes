package accounts

import (
	"encoding/base64"
	"encoding/json"
	"io/ioutil"
	"net/http"
	"os"
	"path/filepath"

	"github.com/ansel1/merry"
	"github.com/ryan/baby-monitor/backend/internal/fatal"
)

const accountsDirectory = "accounts"
const accountsByEmailDirectory = "accounts_by_email"

type AccountStoreFileSystem struct {
	root string
}

func NewAccountStoreFileSystem(root string) (store *AccountStoreFileSystem) {
	store = &AccountStoreFileSystem{
		root: root,
	}
	err := os.MkdirAll(filepath.Join(root, accountsDirectory), 0755)
	fatal.OnError(err)
	err = os.MkdirAll(filepath.Join(root, accountsByEmailDirectory), 0755)
	fatal.OnError(err)
	return
}

func (store *AccountStoreFileSystem) Put(account *Account) (err error) {
	existingAccount, err := store.Get(account.ID)
	if merry.HTTPCode(err) == http.StatusOK {
		return store.update(existingAccount, account)
	}
	return store.create(account)
}

func (store *AccountStoreFileSystem) create(account *Account) (err error) {
	err = store.checkEmail(account.User.Email)
	if err != nil {
		return
	}
	store.write(account)
	return
}

func (store *AccountStoreFileSystem) update(existingAccount *Account, account *Account) (err error) {
	if existingAccount.User.Email != account.User.Email {
		err = store.checkEmail(account.User.Email)
		if err != nil {
			return
		}
		path := store.getAccountByEmailFilePath(existingAccount.User.Email)
		err = os.Remove(path)
		fatal.OnError(err)
	}
	store.write(account)
	return
}

func (store *AccountStoreFileSystem) checkEmail(email string) (err error) {
	_, err = os.Stat(store.getAccountByEmailFilePath(email))
	switch {
	case err == nil:
		err = merry.New("email already in use").WithHTTPCode(http.StatusBadRequest)
		return
	case os.IsNotExist(err):
		err = nil
		return
	default:
		fatal.OnError(err)
		return
	}
}

func (store *AccountStoreFileSystem) write(account *Account) {
	data, err := json.Marshal(account)
	fatal.OnError(err)

	path := store.getAccountFilePath(account.ID)
	err = ioutil.WriteFile(path, data, 0644)
	fatal.OnError(err)

	path = store.getAccountByEmailFilePath(account.User.Email)
	err = ioutil.WriteFile(path, data, 0644)
	fatal.OnError(err)
}

func (store *AccountStoreFileSystem) Get(accountID string) (account *Account, err error) {
	path := store.getAccountFilePath(accountID)
	return store.get(path)
}

func (store *AccountStoreFileSystem) GetByEmail(email string) (account *Account, err error) {
	path := store.getAccountByEmailFilePath(email)
	return store.get(path)
}

func (store *AccountStoreFileSystem) get(path string) (account *Account, err error) {
	file, err := os.Open(path)
	switch {
	case err == nil:
		defer file.Close()
		account = new(Account)
		err = json.NewDecoder(file).Decode(account)
		fatal.OnError(err)
		return
	case os.IsNotExist(err):
		err = merry.New("account not found").WithHTTPCode(http.StatusNotFound)
		return
	default:
		fatal.OnError(err)
		return
	}
}

func (store *AccountStoreFileSystem) Remove(accountID string) (err error) {
	account, err := store.Get(accountID)
	if err != nil {
		return
	}
	path := store.getAccountFilePath(accountID)
	err = os.Remove(path)
	fatal.OnError(err)
	path = store.getAccountByEmailFilePath(account.User.Email)
	err = os.Remove(path)
	fatal.OnError(err)
	return
}

func (store *AccountStoreFileSystem) getAccountFilePath(accountID string) string {
	return filepath.Join(store.root, accountsDirectory, accountID)
}

func (store *AccountStoreFileSystem) getAccountByEmailFilePath(email string) string {
	b64Email := base64.RawURLEncoding.EncodeToString([]byte(email))
	return filepath.Join(store.root, accountsByEmailDirectory, b64Email)
}
