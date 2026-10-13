package models

type UserID struct {
	Issuer  string
	Subject string
}

type User struct {
	ID             UserID          `json:"id"`
	Email          string          `json:"email"`           // can be empty if issuer is not beddybytes
	HashedPassword *HashedPassword `json:"hashed_password"` // only set when issuer is beddybytes
}
