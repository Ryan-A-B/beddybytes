package sendemail

import (
	"context"

	"github.com/Ryan-A-B/baby-monitor/internal/fatal"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	"github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

type SendEmailUsingSESStrategy struct {
	client                      *sesv2.Client
	fromEmailAddress            string
	fromEmailAddressIdentityARN string
}

type NewSendEmailUsingSESStrategyInput struct {
	Client                      *sesv2.Client
	FromEmailAddress            string
	FromEmailAddressIdentityARN string
}

func NewSendEmailUsingSESStrategy(input *NewSendEmailUsingSESStrategyInput) *SendEmailUsingSESStrategy {
	return &SendEmailUsingSESStrategy{
		client:                      input.Client,
		fromEmailAddress:            input.FromEmailAddress,
		fromEmailAddressIdentityARN: input.FromEmailAddressIdentityARN,
	}
}

func (strategy *SendEmailUsingSESStrategy) SendEmail(ctx context.Context, input SendEmailInput) (messageID string) {
	output, err := strategy.client.SendEmail(ctx, &sesv2.SendEmailInput{
		FromEmailAddressIdentityArn: &strategy.fromEmailAddressIdentityARN,
		FromEmailAddress:            &strategy.fromEmailAddress,
		Destination: &types.Destination{
			ToAddresses: []string{input.EmailAddress},
		},
		Content: &types.EmailContent{
			Raw: &types.RawMessage{
				Data: input.Data,
			},
		},
	})
	fatal.OnError(err)
	messageID = *output.MessageId
	return
}
