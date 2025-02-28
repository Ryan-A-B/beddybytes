package mailer

import (
	"bytes"
	"context"
	"log"
)

type ConsoleMailer struct {
	AppHost string
}

type NewConsoleMailerInput struct {
	AppHost string
}

func NewConsoleMailer(input NewConsoleMailerInput) *ConsoleMailer {
	return &ConsoleMailer{
		AppHost: input.AppHost,
	}
}

func (mailer *ConsoleMailer) SendPasswordResetLink(ctx context.Context, input SendPasswordResetLinkInput) error {
	var buffer bytes.Buffer
	passwordResetEmailTemplate.Execute(&buffer, PasswordResetEmailTemplateParameters{
		AppHost: mailer.AppHost,
		Token:   input.Token,
	})
	log.Printf("Sending password reset email to %s\n%s", input.Email, buffer.String())
	return nil
}
