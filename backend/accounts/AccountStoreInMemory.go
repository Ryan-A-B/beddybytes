package accounts

import (
	"bufio"
	"encoding/json"
	"io"
	"net/http"

	"github.com/ansel1/merry"
	"github.com/ryan/baby-monitor/backend/internal/fatal"
)

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

func (accountStore *AccountStoreInMemory) SaveSnapshot(writer io.Writer) {
	encoder := json.NewEncoder(writer)
	for _, account := range accountStore.accounts {
		err := encoder.Encode(account)
		fatal.OnError(err)
	}
}

func (accountStore *AccountStoreInMemory) LoadSnapshot(reader io.Reader) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Bytes()
		var account Account
		err := json.Unmarshal(line, &account)
		fatal.OnError(err)
		accountStore.accounts[account.ID] = &account
		accountStore.accountByEmail[account.User.Email] = &account
	}
	fatal.OnError(scanner.Err())
}
