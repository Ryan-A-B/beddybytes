package sendemail_test

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"os"
	"testing"

	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/baby-monitor/backend/internal/sendemail"
)

func TestSendEmailUsingSESStrategy(t *testing.T) {
	ctx := context.Background()
	fromEmailAddress := os.Getenv("FROM_EMAIL_ADDRESS")
	fromEmailAddressIdentityARN := os.Getenv("FROM_EMAIL_ADDRESS_IDENTITY_ARN")
	toEmailAddress := os.Getenv("TO_EMAIL_ADDRESS")
	fmt.Println(fromEmailAddress, fromEmailAddressIdentityARN, toEmailAddress)
	if fromEmailAddress == "" || fromEmailAddressIdentityARN == "" || toEmailAddress == "" {
		t.Skip("Skipping SendEmailUsingSESStrategy tests")
	}
	Convey("TestSendEmailUsingSESStrategy", t, func() {
		config, err := awsconfig.LoadDefaultConfig(ctx)
		So(err, ShouldBeNil)
		strategy := sendemail.NewSendEmailUsingSESStrategy(&sendemail.NewSendEmailUsingSESStrategyInput{
			Client:                      sesv2.NewFromConfig(config),
			FromEmailAddress:            fromEmailAddress,
			FromEmailAddressIdentityARN: fromEmailAddressIdentityARN,
		})
		emailTemplate, err := template.ParseFiles("early_access.html")
		So(err, ShouldBeNil)
		emailData := struct {
			Name string
		}{
			Name: "Ryan",
		}
		var buffer bytes.Buffer
		buffer.WriteString(fmt.Sprintf("From: \"Baby Monitor by Creative Ilk\" <%s>\n", fromEmailAddress))
		buffer.WriteString(fmt.Sprintf("To: %s\n", toEmailAddress))
		buffer.WriteString("Subject: Baby Camera - Early Access\n")
		buffer.WriteString("Content-Type: text/html; charset=\"UTF-8\";\n")
		buffer.WriteString("\n")
		err = emailTemplate.Execute(&buffer, emailData)
		So(err, ShouldBeNil)
		strategy.SendEmail(ctx, sendemail.SendEmailInput{
			EmailAddress: toEmailAddress,
			Data:         buffer.Bytes(),
		})
	})
}
