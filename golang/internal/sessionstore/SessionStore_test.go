package sessionstore_test

import (
	"testing"
	"time"

	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"

	"github.com/Ryan-A-B/beddybytes/golang/internal/sessions"
	"github.com/Ryan-A-B/beddybytes/golang/internal/sessionstore"
)

func TestSessionStore(t *testing.T) {
	Convey("TestSessionStore", t, func() {
		var store sessionstore.InMemory
		Convey("Put", func() {
			Convey("One account", func() {
				accountID := uuid.NewV4().String()
				Convey("One session", func() {
					session := &sessions.Session{
						AccountID:        accountID,
						ID:               uuid.NewV4().String(),
						Name:             uuid.NewV4().String(),
						HostConnectionID: uuid.NewV4().String(),
						StartedAt:        time.Now(),
					}
					store.Put(session)
					Convey("List", func() {
						sessions := store.List(accountID)
						So(len(sessions), ShouldEqual, 1)
						So(sessions[0], ShouldResemble, session)
					})
					Convey("Remove", func() {
						store.Remove(accountID, session.ID)
						sessions := store.List(accountID)
						So(len(sessions), ShouldEqual, 0)
					})
				})
				Convey("Two sessions", func() {
					accountID := uuid.NewV4().String()
					var session = [2]*sessions.Session{
						{
							AccountID:        accountID,
							ID:               "aaaaa",
							Name:             uuid.NewV4().String(),
							HostConnectionID: uuid.NewV4().String(),
							StartedAt:        time.Now(),
						},
						{
							AccountID:        accountID,
							ID:               "bbbbb",
							Name:             uuid.NewV4().String(),
							HostConnectionID: uuid.NewV4().String(),
							StartedAt:        time.Now(),
						},
					}
					Convey("first then second", func() {
						store.Put(session[0])
						store.Put(session[1])
						Convey("List", func() {
							sessions := store.List(accountID)
							So(len(sessions), ShouldEqual, 2)
							So(sessions[0], ShouldResemble, session[0])
							So(sessions[1], ShouldResemble, session[1])
						})
						Convey("Remove", func() {
							store.Remove(accountID, session[0].ID)
							sessions := store.List(accountID)
							So(len(sessions), ShouldEqual, 1)
							So(sessions[0], ShouldResemble, session[1])
						})
					})
					Convey("second then first", func() {
						store.Put(session[1])
						store.Put(session[0])
						Convey("List", func() {
							sessions := store.List(accountID)
							So(len(sessions), ShouldEqual, 2)
							So(sessions[0], ShouldResemble, session[0])
							So(sessions[1], ShouldResemble, session[1])
						})
						Convey("Remove", func() {
							store.Remove(accountID, session[1].ID)
							sessions := store.List(accountID)
							So(len(sessions), ShouldEqual, 1)
							So(sessions[0], ShouldResemble, session[0])
						})
					})
				})
				Convey("Many sessions", func() {
					accountID := uuid.NewV4().String()
					sessionByID := map[string]*sessions.Session{}
					for i := 0; i < 100; i++ {
						session := &sessions.Session{
							AccountID:        accountID,
							ID:               uuid.NewV4().String(),
							Name:             uuid.NewV4().String(),
							HostConnectionID: uuid.NewV4().String(),
							StartedAt:        time.Now(),
						}
						sessionByID[session.ID] = session
						store.Put(session)
					}
					Convey("List and Remove", func() {
						sessions := store.List(accountID)
						So(len(sessions), ShouldEqual, 100)
						for _, session := range sessions {
							So(session, ShouldResemble, sessionByID[session.ID])
							store.Remove(accountID, session.ID)
						}
						sessions = store.List(accountID)
						So(len(sessions), ShouldEqual, 0)
					})
				})
				Convey("Duplicate session", func() {
					accountID := uuid.NewV4().String()
					session := &sessions.Session{
						AccountID:        accountID,
						ID:               uuid.NewV4().String(),
						Name:             uuid.NewV4().String(),
						HostConnectionID: uuid.NewV4().String(),
						StartedAt:        time.Now(),
					}
					store.Put(session)
					store.Put(session)
					Convey("List", func() {
						sessions := store.List(accountID)
						So(len(sessions), ShouldEqual, 1)
						So(sessions[0], ShouldResemble, session)
					})
					Convey("Remove", func() {
						store.Remove(accountID, session.ID)
						sessions := store.List(accountID)
						So(len(sessions), ShouldEqual, 0)
					})
				})
			})
			Convey("Two accounts", func() {
				var accountIDs = [2]string{
					uuid.NewV4().String(),
					uuid.NewV4().String(),
				}
				Convey("One session per account", func() {
					var session = [2]*sessions.Session{
						{
							AccountID:        accountIDs[0],
							ID:               uuid.NewV4().String(),
							Name:             uuid.NewV4().String(),
							HostConnectionID: uuid.NewV4().String(),
							StartedAt:        time.Now(),
						},
						{
							AccountID:        accountIDs[1],
							ID:               uuid.NewV4().String(),
							Name:             uuid.NewV4().String(),
							HostConnectionID: uuid.NewV4().String(),
							StartedAt:        time.Now(),
						},
					}
					store.Put(session[0])
					store.Put(session[1])
					Convey("List", func() {
						sessions := store.List(accountIDs[0])
						So(len(sessions), ShouldEqual, 1)
						So(sessions[0], ShouldResemble, session[0])
						sessions = store.List(accountIDs[1])
						So(len(sessions), ShouldEqual, 1)
						So(sessions[0], ShouldResemble, session[1])
					})
					Convey("Remove", func() {
						store.Remove(accountIDs[0], session[0].ID)
						sessions := store.List(accountIDs[0])
						So(len(sessions), ShouldEqual, 0)
						sessions = store.List(accountIDs[1])
						So(len(sessions), ShouldEqual, 1)
						So(sessions[0], ShouldResemble, session[1])
					})
				})
				Convey("Two sessions per account", func() {
					var session = [4]*sessions.Session{
						{
							AccountID:        accountIDs[0],
							ID:               "aaaaa",
							Name:             uuid.NewV4().String(),
							HostConnectionID: uuid.NewV4().String(),
							StartedAt:        time.Now(),
						},
						{
							AccountID:        accountIDs[1],
							ID:               "bbbbb",
							Name:             uuid.NewV4().String(),
							HostConnectionID: uuid.NewV4().String(),
							StartedAt:        time.Now(),
						},
						{
							AccountID:        accountIDs[1],
							ID:               "aaaaa",
							Name:             uuid.NewV4().String(),
							HostConnectionID: uuid.NewV4().String(),
							StartedAt:        time.Now(),
						},
						{
							AccountID:        accountIDs[0],
							ID:               "bbbbb",
							Name:             uuid.NewV4().String(),
							HostConnectionID: uuid.NewV4().String(),
							StartedAt:        time.Now(),
						},
					}
					store.Put(session[0])
					store.Put(session[1])
					store.Put(session[2])
					store.Put(session[3])
					Convey("List", func() {
						sessions := store.List(accountIDs[0])
						So(len(sessions), ShouldEqual, 2)
						So(sessions[0], ShouldResemble, session[0])
						So(sessions[1], ShouldResemble, session[3])
						sessions = store.List(accountIDs[1])
						So(len(sessions), ShouldEqual, 2)
						So(sessions[0], ShouldResemble, session[2])
						So(sessions[1], ShouldResemble, session[1])
					})
					Convey("Remove 0", func() {
						sessionToRemove := session[0]
						store.Remove(sessionToRemove.AccountID, sessionToRemove.ID)
						sessions := store.List(accountIDs[0])
						So(len(sessions), ShouldEqual, 1)
						So(sessions[0], ShouldResemble, session[3])
						sessions = store.List(accountIDs[1])
						So(len(sessions), ShouldEqual, 2)
						So(sessions[0], ShouldResemble, session[2])
						So(sessions[1], ShouldResemble, session[1])
					})
					Convey("Remove 1", func() {
						sessionToRemove := session[1]
						store.Remove(sessionToRemove.AccountID, sessionToRemove.ID)
						sessions := store.List(accountIDs[0])
						So(len(sessions), ShouldEqual, 2)
						So(sessions[0], ShouldResemble, session[0])
						So(sessions[1], ShouldResemble, session[3])
						sessions = store.List(accountIDs[1])
						So(len(sessions), ShouldEqual, 1)
						So(sessions[0], ShouldResemble, session[2])
					})
					Convey("Remove 2", func() {
						sessionToRemove := session[2]
						store.Remove(sessionToRemove.AccountID, sessionToRemove.ID)
						sessions := store.List(accountIDs[0])
						So(len(sessions), ShouldEqual, 2)
						So(sessions[0], ShouldResemble, session[0])
						So(sessions[1], ShouldResemble, session[3])
						sessions = store.List(accountIDs[1])
						So(len(sessions), ShouldEqual, 1)
						So(sessions[0], ShouldResemble, session[1])
					})
					Convey("Remove 3", func() {
						sessionToRemove := session[3]
						store.Remove(sessionToRemove.AccountID, sessionToRemove.ID)
						sessions := store.List(accountIDs[0])
						So(len(sessions), ShouldEqual, 1)
						So(sessions[0], ShouldResemble, session[0])
						sessions = store.List(accountIDs[1])
						So(len(sessions), ShouldEqual, 2)
						So(sessions[0], ShouldResemble, session[2])
						So(sessions[1], ShouldResemble, session[1])
					})
				})
				Convey("Many sessions per account", func() {
					sessionByID := map[string]*sessions.Session{}
					for i := 0; i < 200; i++ {
						session := &sessions.Session{
							AccountID:        accountIDs[i%2],
							ID:               uuid.NewV4().String(),
							Name:             uuid.NewV4().String(),
							HostConnectionID: uuid.NewV4().String(),
							StartedAt:        time.Now(),
						}
						sessionByID[session.ID] = session
						store.Put(session)
					}
					Convey("List and Remove", func() {
						sessions := store.List(accountIDs[0])
						for _, session := range sessions {
							So(session, ShouldResemble, sessionByID[session.ID])
							store.Remove(accountIDs[0], session.ID)
						}
						sessions = store.List(accountIDs[0])
						So(len(sessions), ShouldEqual, 0)
						sessions = store.List(accountIDs[1])
						for _, session := range sessions {
							So(session, ShouldResemble, sessionByID[session.ID])
							store.Remove(accountIDs[1], session.ID)
						}
						sessions = store.List(accountIDs[1])
						So(len(sessions), ShouldEqual, 0)
					})
				})
			})
			Convey("Many accounts", func() {
				accountIDs := make([]string, 0, 100)
				for i := 0; i < 100; i++ {
					accountIDs = append(accountIDs, uuid.NewV4().String())
				}
				Convey("One session per account", func() {
					sessionByAccountID := make(map[string]*sessions.Session)
					for _, accountID := range accountIDs {
						session := &sessions.Session{
							AccountID:        accountID,
							ID:               uuid.NewV4().String(),
							Name:             uuid.NewV4().String(),
							HostConnectionID: uuid.NewV4().String(),
							StartedAt:        time.Now(),
						}
						sessionByAccountID[accountID] = session
						store.Put(session)
					}
					Convey("List", func() {
						for _, accountID := range accountIDs {
							sessions := store.List(accountID)
							So(len(sessions), ShouldEqual, 1)
							So(sessions[0], ShouldResemble, sessionByAccountID[accountID])
						}
					})
				})
				Convey("Two sessions per account", func() {
					sessionsByAccountID := make(map[string][2]*sessions.Session)
					for _, accountID := range accountIDs {
						sessions := [2]*sessions.Session{
							{
								AccountID:        accountID,
								ID:               "aaaaa",
								Name:             uuid.NewV4().String(),
								HostConnectionID: uuid.NewV4().String(),
								StartedAt:        time.Now(),
							},
							{
								AccountID:        accountID,
								ID:               "bbbbb",
								Name:             uuid.NewV4().String(),
								HostConnectionID: uuid.NewV4().String(),
								StartedAt:        time.Now(),
							},
						}
						sessionsByAccountID[accountID] = sessions
						store.Put(sessions[0])
						store.Put(sessions[1])
					}
					Convey("List", func() {
						for _, accountID := range accountIDs {
							sessions := store.List(accountID)
							So(len(sessions), ShouldEqual, 2)
							So(sessions[0], ShouldResemble, sessionsByAccountID[accountID][0])
							So(sessions[1], ShouldResemble, sessionsByAccountID[accountID][1])
						}
					})
				})
				Convey("Many sessions per account", func() {
					sessionByIDByAccountID := make(map[string]map[string]*sessions.Session)
					for _, accountID := range accountIDs {
						sessionByID := make(map[string]*sessions.Session)
						for i := 0; i < 100; i++ {
							session := &sessions.Session{
								AccountID:        accountID,
								ID:               uuid.NewV4().String(),
								Name:             uuid.NewV4().String(),
								HostConnectionID: uuid.NewV4().String(),
								StartedAt:        time.Now(),
							}
							sessionByID[session.ID] = session
							store.Put(session)
						}
						sessionByIDByAccountID[accountID] = sessionByID
					}
					Convey("List", func() {
						for _, accountID := range accountIDs {
							sessions := store.List(accountID)
							So(len(sessions), ShouldEqual, 100)
							for _, session := range sessions {
								So(session, ShouldResemble, sessionByIDByAccountID[accountID][session.ID])
								store.Remove(accountID, session.ID)
							}
							sessions = store.List(accountID)
							So(len(sessions), ShouldEqual, 0)
						}
					})
				})
			})
		})
	})
}
