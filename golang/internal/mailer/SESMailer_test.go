package mailer_test

import (
	"context"
	"os"
	"testing"

	"github.com/Ryan-A-B/beddybytes/golang/internal/mailer"
	"github.com/aws/aws-sdk-go-v2/config"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSESMailer(t *testing.T) {
	Convey("TestSESMailer", t, func() {
		fromEmail := os.Getenv("SES_MAILER_TEST_FROM_EMAIL")
		if fromEmail == "" {
			t.Skip("Skipping test as SES_MAILER_TEST_FROM_EMAIL is not set")
		}
		destinationEmail := os.Getenv("SES_MAILER_TEST_DESTINATION_EMAIL")
		if destinationEmail == "" {
			t.Skip("Skipping test as SES_MAILER_TEST_DESTINATION_EMAIL is not set")
		}
		cfg, err := config.LoadDefaultConfig(context.Background())
		So(err, ShouldBeNil)
		m := mailer.NewSESMailer(mailer.NewSESMailerInput{
			AWSConfig: cfg,
			From:      fromEmail,
			AppHost:   "localhost:3000",
		})
		input := mailer.SendPasswordResetLinkInput{
			Email: destinationEmail,
			Token: "dummy-token",
		}
		err = m.SendPasswordResetLink(context.Background(), input)
		So(err, ShouldBeNil)
	})
}
