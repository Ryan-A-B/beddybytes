package accounts

import (
	"crypto/sha256"
	"io"
	"net/http"

	"github.com/ansel1/merry"
	"github.com/ryan/baby-monitor/backend/internal/fatal"
)

type Account struct {
	ID   string `json:"id"`
	User User   `json:"user"`
}

type User struct {
	ID           string `json:"id"`
	Email        string
	PasswordSalt []byte
	PasswordHash []byte
}

type AccountStore interface {
	Put(account *Account) (err error)
	Get(accountID string) (account *Account, err error)
	GetByEmail(email string) (account *Account, err error)
	Remove(accountID string) (err error)
}

type AccountStoreInMemory struct {
	accounts       map[string]*Account
	accountByEmail map[string]*Account
}

func NewAccountStoreInMemory() (accountStore *AccountStoreInMemory) {
	accountStore = &AccountStoreInMemory{
		accounts:       make(map[string]*Account),
		accountByEmail: make(map[string]*Account),
	}
	return
}

func (accountStore *AccountStoreInMemory) Put(account *Account) (err error) {
	existingAccount, ok := accountStore.accounts[account.ID]
	if ok {
		return accountStore.update(existingAccount, account)
	}
	return accountStore.create(account)
}

func (accountStore *AccountStoreInMemory) create(account *Account) (err error) {
	err = accountStore.checkEmail(account.User.Email)
	if err != nil {
		return
	}
	accountStore.accounts[account.ID] = account
	accountStore.accountByEmail[account.User.Email] = account
	return
}

func (accountStore *AccountStoreInMemory) update(existingAccount *Account, account *Account) (err error) {
	if existingAccount.User.Email != account.User.Email {
		err = accountStore.checkEmail(account.User.Email)
		if err != nil {
			return
		}
		delete(accountStore.accountByEmail, existingAccount.User.Email)
	}
	accountStore.accounts[account.ID] = account
	accountStore.accountByEmail[account.User.Email] = account
	return
}

func (accountStore *AccountStoreInMemory) checkEmail(email string) (err error) {
	_, ok := accountStore.accountByEmail[email]
	if ok {
		err = merry.New("email already in use").WithHTTPCode(http.StatusBadRequest)
		return
	}
	return
}

func (accountStore *AccountStoreInMemory) Get(accountID string) (account *Account, err error) {
	account, ok := accountStore.accounts[accountID]
	if !ok {
		err = merry.New("account not found").WithHTTPCode(http.StatusNotFound)
		return
	}
	return
}

func (accountStore *AccountStoreInMemory) GetByEmail(email string) (account *Account, err error) {
	account, ok := accountStore.accountByEmail[email]
	if !ok {
		err = merry.New("account not found").WithHTTPCode(http.StatusNotFound)
		return
	}
	return
}

func (accountStore *AccountStoreInMemory) Remove(accountID string) (err error) {
	account, ok := accountStore.accounts[accountID]
	if !ok {
		return
	}
	delete(accountStore.accounts, accountID)
	delete(accountStore.accountByEmail, account.User.Email)
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
