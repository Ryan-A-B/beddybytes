package sendemail

import "context"

type SendEmailInput struct {
	EmailAddress string
	Data         []byte
}

type SendEmailFunc func(ctx context.Context, input SendEmailInput) (messageID string)
