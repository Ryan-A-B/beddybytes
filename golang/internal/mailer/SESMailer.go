package mailer

import (
	"bytes"
	"context"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

type SESMailer struct {
	client  *sesv2.Client
	from    string
	appHost string
}

type NewSESMailerInput struct {
	AWSConfig aws.Config
	From      string
	AppHost   string
}

func NewSESMailer(input NewSESMailerInput) *SESMailer {
	return &SESMailer{
		client:  sesv2.NewFromConfig(input.AWSConfig),
		from:    input.From,
		appHost: input.AppHost,
	}
}

func (mailer *SESMailer) SendPasswordResetLink(ctx context.Context, input SendPasswordResetLinkInput) (err error) {
	var buffer bytes.Buffer
	passwordResetEmailTemplate.Execute(&buffer, PasswordResetEmailTemplateParameters{
		AppHost: mailer.appHost,
		Token:   input.Token,
	})
	_, err = mailer.client.SendEmail(ctx, &sesv2.SendEmailInput{
		FromEmailAddress: &mailer.from,
		Destination: &types.Destination{
			ToAddresses: []string{input.Email},
		},
		Content: &types.EmailContent{
			Simple: &types.Message{
				Subject: &types.Content{
					Data: aws.String("Reset your password"),
				},
				Body: &types.Body{
					Text: &types.Content{
						Data: aws.String(buffer.String()),
					},
				},
			},
		},
	})
	return
}
