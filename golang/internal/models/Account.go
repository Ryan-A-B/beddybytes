package models

type Account struct {
	ID      string  `json:"id"`
	License License `json:"license"`
	Users   []*User `json:"users"`
}
