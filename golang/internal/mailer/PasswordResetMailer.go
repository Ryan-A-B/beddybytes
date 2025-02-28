package mailer

import (
	"context"
	_ "embed"
	"text/template"
)

//go:embed emails/password-reset.txt
var passwordResetEmail string
var passwordResetEmailTemplate = template.Must(template.New("password reset link").Parse(passwordResetEmail))

type PasswordResetEmailTemplateParameters struct {
	AppHost string
	Token   string
}

type SendPasswordResetLinkInput struct {
	Email string
	Token string
}

type PasswordResetMailer interface {
	SendPasswordResetLink(ctx context.Context, input SendPasswordResetLinkInput) error
}
