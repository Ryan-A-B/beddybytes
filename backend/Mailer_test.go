package main

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/backend/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/backend/internal/sendemail"
	"github.com/Ryan-A-B/beddybytes/internal/fatal"
	"github.com/Ryan-A-B/beddybytes/internal/square"
	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"
)

func TestMailer(t *testing.T) {
	Convey("TestMailer", t, func() {
		ctx := context.Background()
		emailDeferralDuration := 100 * time.Millisecond
		timeoutDuration := 2 * emailDeferralDuration
		folderPath, err := os.MkdirTemp("testdata", "TestMailer-*")
		if err != nil {
			panic(err)
		}
		eventLog := eventlog.NewThreadSafeDecorator(&eventlog.NewThreadSafeDecoratorInput{
			Decorated: eventlog.NewFollowingDecorator(&eventlog.NewFollowingDecoratorInput{
				Decorated: eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
					FolderPath: folderPath,
				}),
				BufferSize: 32,
			}),
		})
		sendEmailC := make(chan string, 8)
		sendEmail := func(ctx context.Context, input sendemail.SendEmailInput) (messageID string) {
			messageID = uuid.NewV4().String()
			sendEmailC <- messageID
			return
		}
		mailer := NewMailer(&NewMailerInput{
			EventLog:              eventLog,
			SendEmail:             sendEmail,
			EmailDeferralDuration: emailDeferralDuration,
		})
		go mailer.Run(ctx)
		Convey("send early access email", func() {
			mailer.sendEarlyAccessEmail(ctx, SendEarlyAccessEmailInput{
				Name:          "Ryan",
				EmailAddress:  "ryan.a.ballinger@gmail.com",
				SquareOrderID: uuid.NewV4().String(),
			})
			select {
			case messageID := <-sendEmailC:
				So(messageID, ShouldNotBeEmpty)
			case <-time.After(timeoutDuration):
				t.Error("timeout")
			}
			select {
			case <-sendEmailC:
				t.Error("unexpected message")
			case <-time.After(timeoutDuration):
				So("timeout", ShouldNotBeNil)
			}
			Convey("after order", func() {
				customerID := uuid.NewV4().String()
				squareOrderID := uuid.NewV4().String()
				_, err := eventLog.Append(ctx, &eventlog.AppendInput{
					Type: "square.customer.updated",
					Data: fatal.UnlessMarshalJSON(map[string]interface{}{
						"data": map[string]interface{}{
							"type": "customer",
							"object": map[string]interface{}{
								"customer": &square.Customer{
									ID:           customerID,
									GivenName:    "Ryan",
									EmailAddress: "ryan.a.ballinger@gmail.com",
								},
							},
						},
					}),
				})
				So(err, ShouldBeNil)
				_, err = eventLog.Append(ctx, &eventlog.AppendInput{
					Type: "square.payment.updated",
					Data: fatal.UnlessMarshalJSON(map[string]interface{}{
						"data": map[string]interface{}{
							"type": "payment",
							"object": map[string]interface{}{
								"payment": &square.Payment{
									OrderID:    squareOrderID,
									CustomerID: customerID,
									Status:     "COMPLETED",
								},
							},
						},
					}),
				})
				So(err, ShouldBeNil)
				select {
				case messageID := <-sendEmailC:
					So(messageID, ShouldNotBeEmpty)
				case <-time.After(timeoutDuration):
					t.Error("timeout")
				}
				select {
				case <-sendEmailC:
					t.Error("unexpected message")
				case <-time.After(timeoutDuration):
					So("timeout", ShouldNotBeNil)
				}
				Convey("don't send email twice", func() {
					Convey("due to restart", func() {
						mailer := NewMailer(&NewMailerInput{
							EventLog:              eventLog,
							SendEmail:             sendEmail,
							EmailDeferralDuration: emailDeferralDuration,
						})
						go mailer.Run(ctx)
						select {
						case <-sendEmailC:
							t.Error("unexpected message")
						case <-time.After(timeoutDuration):
							So("timeout", ShouldNotBeNil)
						}
					})
					Convey("due to duplicate payment event", func() {
						_, err = eventLog.Append(ctx, &eventlog.AppendInput{
							Type: "square.payment.updated",
							Data: fatal.UnlessMarshalJSON(map[string]interface{}{
								"data": map[string]interface{}{
									"type": "payment",
									"object": map[string]interface{}{
										"payment": &square.Payment{
											OrderID:    squareOrderID,
											CustomerID: customerID,
											Status:     "COMPLETED",
										},
									},
								},
							}),
						})
						So(err, ShouldBeNil)
						select {
						case <-sendEmailC:
							t.Error("unexpected message")
						case <-time.After(timeoutDuration):
							So("timeout", ShouldNotBeNil)
						}
					})
				})
			})
		})
	})
}
