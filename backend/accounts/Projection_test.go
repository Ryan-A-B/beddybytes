package accounts_test

import (
	"context"
	"encoding/json"
	"os"
	"testing"
	"time"

	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/baby-monitor/backend/accounts"
	"github.com/Ryan-A-B/baby-monitor/backend/internal/eventlog"
	"github.com/Ryan-A-B/baby-monitor/backend/internal/store"
	"github.com/Ryan-A-B/baby-monitor/internal/square"
)

func TestProjection(t *testing.T) {
	Convey("Projection", t, func() {
		ctx := context.Background()
		t0 := time.Now()
		handlers := accounts.Handlers{
			EventLog: newEventLog(ctx),
			AccountStore: &accounts.AccountStore{
				Store: store.NewMemoryStore(),
			},
			PaymentLinkByAccountID:    make(map[string]*square.PaymentLink),
			AppliedInvoiceIDs:         make(map[string]struct{}),
			AccountIDByOrderID:        make(map[string]string),
			AccountIDBySubscriptionID: make(map[string]string),
			SquareSubscriptionByID:    make(map[string]*square.Subscription),
		}
		go eventlog.Project(ctx, &eventlog.ProjectInput{
			EventLog:   handlers.EventLog,
			FromCursor: 0,
			Apply:      handlers.ApplyEvent,
		})
		Convey("create account", func() {
			user := accounts.NewUser(&accounts.NewUserInput{
				Email:    "test@example.com",
				Password: uuid.NewV4().String(),
			})
			trialExpiry := t0.AddDate(0, 0, 7).UTC()
			expectedAccount := accounts.Account{
				ID: uuid.NewV4().String(),
				Subscription: accounts.Subscription{
					State: accounts.SubscriptionStateTrial,
					Trial: &accounts.SubscriptionTrial{
						Expiry: trialExpiry,
					},
				},
				User: user,
			}
			data, err := json.Marshal(&expectedAccount)
			So(err, ShouldBeNil)
			_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
				Type: accounts.EventTypeAccountCreated,
				Data: data,
			})
			So(err, ShouldBeNil)
			time.Sleep(10 * time.Millisecond)
			account, err := handlers.AccountStore.Get(ctx, expectedAccount.ID)
			So(err, ShouldBeNil)
			So(account, ShouldResemble, &expectedAccount)

			Convey("create payment link", func() {
				frame := accounts.PaymentLinkFrame{
					AccountID: account.ID,
					PaymentLink: &square.PaymentLink{
						ID:      uuid.NewV4().String(),
						OrderID: uuid.NewV4().String(),
						URL:     "https://example.com",
					},
				}
				data, err := json.Marshal(&frame)
				So(err, ShouldBeNil)
				_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
					Type: accounts.EventTypePaymentLinkCreated,
					Data: data,
				})
				So(err, ShouldBeNil)
				time.Sleep(10 * time.Millisecond)
				accountID, ok := handlers.AccountIDByOrderID[frame.PaymentLink.OrderID]
				So(ok, ShouldBeTrue)
				So(accountID, ShouldEqual, account.ID)
				paymentLink, ok := handlers.PaymentLinkByAccountID[account.ID]
				So(ok, ShouldBeTrue)
				So(paymentLink, ShouldResemble, frame.PaymentLink)

				Convey("apply square subscription created", func() {
					subscriptionID := uuid.NewV4().String()
					buyerSelfManagementToken := uuid.NewV4().String()
					squareEvent := square.Event{
						Type: "subscription.created",
						Data: square.EventData{
							Type: "subscription",
							Object: square.Object{
								Subscription: &square.Subscription{
									ID:                       subscriptionID,
									OrderTemplateID:          frame.PaymentLink.OrderID,
									BuyerSelfManagementToken: buyerSelfManagementToken,
								},
							},
						},
					}
					data, err := json.Marshal(&squareEvent)
					So(err, ShouldBeNil)
					_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
						Type: "square." + string(squareEvent.Type),
						Data: data,
					})
					So(err, ShouldBeNil)
					time.Sleep(10 * time.Millisecond)
					account, err := handlers.AccountStore.Get(ctx, account.ID)
					So(err, ShouldBeNil)
					So(account.Subscription.State, ShouldEqual, accounts.SubscriptionStateTrial)
					So(account.Subscription.Trial, ShouldNotBeNil)
					So(account.Subscription.Trial.Expiry, ShouldEqual, trialExpiry)

					Convey("apply square invoice created", func() {
						invoiceID := uuid.NewV4().String()
						squareEvent := square.Event{
							Type: "invoice.created",
							Data: square.EventData{
								Type: "invoice",
								Object: square.Object{
									Invoice: &square.Invoice{
										ID:             invoiceID,
										SubscriptionID: subscriptionID,
										Status:         square.InvoiceStatusDraft,
									},
								},
							},
						}
						data, err := json.Marshal(&squareEvent)
						So(err, ShouldBeNil)
						_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
							Type: "square." + string(squareEvent.Type),
							Data: data,
						})
						So(err, ShouldBeNil)
						time.Sleep(10 * time.Millisecond)
						account, err := handlers.AccountStore.Get(ctx, account.ID)
						So(err, ShouldBeNil)
						So(account.Subscription.State, ShouldEqual, accounts.SubscriptionStateTrial)
						So(account.Subscription.Trial, ShouldNotBeNil)
						So(account.Subscription.Trial.Expiry, ShouldEqual, trialExpiry)

						Convey("apply square invoice published", func() {
							squareEvent := square.Event{
								Type: "invoice.published",
								Data: square.EventData{
									Type: "invoice",
									Object: square.Object{
										Invoice: &square.Invoice{
											ID:             invoiceID,
											SubscriptionID: subscriptionID,
											Status:         square.InvoiceStatusPaid,
										},
									},
								},
							}
							data, err := json.Marshal(&squareEvent)
							So(err, ShouldBeNil)
							_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
								Type: "square." + string(squareEvent.Type),
								Data: data,
							})
							So(err, ShouldBeNil)
							time.Sleep(10 * time.Millisecond)
							account, err := handlers.AccountStore.Get(ctx, account.ID)
							So(err, ShouldBeNil)
							So(account.Subscription.State, ShouldEqual, accounts.SubscriptionStateActive)
							So(account.Subscription.Active, ShouldNotBeNil)
							So(account.Subscription.Active.ManagementURL, ShouldEqual, "https://squareup.com/buyer-subscriptions/manage?buyer_management_token="+buyerSelfManagementToken)
							So(account.Subscription.Active.Expiry, ShouldEqual, trialExpiry.AddDate(0, 1, 0))

							Convey("apply square invoice payment made", func() {
								squareEvent := square.Event{
									Type: "invoice.payment_made",
									Data: square.EventData{
										Type: "invoice",
										Object: square.Object{
											Invoice: &square.Invoice{
												ID:             invoiceID,
												SubscriptionID: subscriptionID,
												Status:         square.InvoiceStatusPaid,
											},
										},
									},
								}
								data, err := json.Marshal(&squareEvent)
								So(err, ShouldBeNil)
								_, err = handlers.EventLog.Append(ctx, &eventlog.AppendInput{
									Type: "square." + string(squareEvent.Type),
									Data: data,
								})
								So(err, ShouldBeNil)
								time.Sleep(10 * time.Millisecond)
								account, err := handlers.AccountStore.Get(ctx, account.ID)
								So(err, ShouldBeNil)
								So(account.Subscription.State, ShouldEqual, accounts.SubscriptionStateActive)
								So(account.Subscription.Active, ShouldNotBeNil)
								So(account.Subscription.Active.ManagementURL, ShouldEqual, "https://squareup.com/buyer-subscriptions/manage?buyer_management_token="+buyerSelfManagementToken)
								So(account.Subscription.Active.Expiry, ShouldEqual, trialExpiry.AddDate(0, 1, 0))
							})
						})
					})
				})
			})
		})
	})
}

func newEventLog(ctx context.Context) *eventlog.FollowingDecorator {
	folderPath, err := os.MkdirTemp("testdata", "eventlog-*")
	So(err, ShouldBeNil)
	return eventlog.NewFollowingDecorator(&eventlog.NewFollowingDecoratorInput{
		Decorated: eventlog.NewFileEventLog(&eventlog.NewFileEventLogInput{
			FolderPath: folderPath,
		}),
		BufferSize: 128,
	})
}
