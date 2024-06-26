package main

import (
	"bytes"
	"context"
	"fmt"
	"html/template"
	"time"

	"github.com/Ryan-A-B/beddybytes/backend/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/backend/internal/sendemail"
	"github.com/Ryan-A-B/beddybytes/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/internal/square"
)

const EventTypeEarlyAccessEmailSent = "mailer.early_access.email_sent"

type EarlyAccessEmailSentEventData struct {
	EmailAddress  string `json:"email"`
	MessageID     string `json:"message_id"`
	SquareOrderID string `json:"square_order_id"`
}

type Mailer struct {
	earlyAccessTemplate   *template.Template
	eventLog              eventlog.EventLog
	fromEmailAddress      string
	sendEmail             sendemail.SendEmailFunc
	emailDeferralDuration time.Duration

	customers              map[string]*square.Customer
	deferredEmailByOrderID map[string]SendEarlyAccessEmailInput
	processedOrders        map[string]struct{}
}

type NewMailerInput struct {
	EventLog              eventlog.EventLog
	FromEmailAddress      string
	SendEmail             sendemail.SendEmailFunc
	EmailDeferralDuration time.Duration
}

func NewMailer(input *NewMailerInput) *Mailer {
	earlyAccessTemplate, err := template.ParseFiles("email_templates/early_access.html")
	fatal.OnError(err)
	return &Mailer{
		earlyAccessTemplate:   earlyAccessTemplate,
		eventLog:              input.EventLog,
		fromEmailAddress:      input.FromEmailAddress,
		sendEmail:             input.SendEmail,
		emailDeferralDuration: input.EmailDeferralDuration,

		customers:              make(map[string]*square.Customer),
		deferredEmailByOrderID: make(map[string]SendEarlyAccessEmailInput),
		processedOrders:        make(map[string]struct{}),
	}
}

func (mailer *Mailer) Run(ctx context.Context) {
	const firstOfApril2024 = 1711893600
	eventC := make(chan *eventlog.Event, 8)
	go eventlog.StreamToChannel(ctx, &eventlog.StreamToChannelInput{
		EventLog:   mailer.eventLog,
		FromCursor: 0,
		C:          eventC,
	})
	for {
		select {
		case event := <-eventC:
			if event.UnixTimestamp < firstOfApril2024 {
				continue
			}
			switch event.Type {
			case "square.payment.created", "square.payment.updated":
				mailer.applyPaymentEvent(ctx, event)
			case EventTypeEarlyAccessEmailSent:
				mailer.applyEarlyAccessEmailSentEvent(ctx, event)
			}
		// TODO this has the potential to never send emails if there are too many events
		case <-time.After(mailer.emailDeferralDuration):
			mailer.sendDeferredEmails(ctx)
		}
	}
}

func (mailer *Mailer) applyPaymentEvent(ctx context.Context, event *eventlog.Event) {
	// TODO ensure that the order is for early access
	var squareEvent square.Event
	fatal.UnlessUnmarshalJSON(event.Data, &squareEvent)
	payment := squareEvent.Data.Object.Payment
	if payment.Status != "COMPLETED" {
		return
	}
	if _, ok := mailer.processedOrders[payment.OrderID]; ok {
		return
	}
	mailer.deferredEmailByOrderID[payment.OrderID] = SendEarlyAccessEmailInput{
		EmailAddress:  payment.BuyerEmailAddress,
		SquareOrderID: payment.OrderID,
	}
	mailer.processedOrders[payment.OrderID] = struct{}{}
}

func (mailer *Mailer) applyEarlyAccessEmailSentEvent(ctx context.Context, event *eventlog.Event) {
	var data EarlyAccessEmailSentEventData
	fatal.UnlessUnmarshalJSON(event.Data, &data)
	delete(mailer.deferredEmailByOrderID, data.SquareOrderID)
}

func (mailer *Mailer) sendDeferredEmails(ctx context.Context) {
	for orderID, input := range mailer.deferredEmailByOrderID {
		messageID := mailer.sendEarlyAccessEmail(ctx, input)
		mailer.eventLog.Append(ctx, &eventlog.AppendInput{
			Type: EventTypeEarlyAccessEmailSent,
			Data: fatal.UnlessMarshalJSON(&EarlyAccessEmailSentEventData{
				EmailAddress:  input.EmailAddress,
				MessageID:     messageID,
				SquareOrderID: input.SquareOrderID,
			}),
		})
		delete(mailer.deferredEmailByOrderID, orderID)
	}
}

type SendEarlyAccessEmailInput struct {
	EmailAddress  string
	SquareOrderID string
}

func (mailer *Mailer) sendEarlyAccessEmail(ctx context.Context, input SendEarlyAccessEmailInput) (messageID string) {
	buffer := new(bytes.Buffer)
	buffer.WriteString(fmt.Sprintf("From: %s\n", mailer.fromEmailAddress))
	buffer.WriteString(fmt.Sprintf("To: %s\n", input.EmailAddress))
	buffer.WriteString("Subject: BeddyBytes - Early Access\n")
	buffer.WriteString("Content-Type: text/html; charset=\"UTF-8\";\n")
	buffer.WriteString("\n")
	err := mailer.earlyAccessTemplate.Execute(buffer, input)
	fatal.OnError(err)
	return mailer.sendEmail(ctx, sendemail.SendEmailInput{
		EmailAddress: input.EmailAddress,
		Data:         buffer.Bytes(),
	})
}
