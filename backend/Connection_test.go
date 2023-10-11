package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/Ryan-A-B/baby-monitor/backend/internal"
	"github.com/Ryan-A-B/baby-monitor/backend/internal/eventlog"
	"github.com/Ryan-A-B/baby-monitor/backend/internal/store2"
	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	uuid "github.com/satori/go.uuid"
	. "github.com/smartystreets/goconvey/convey"
)

func MockAuthorizationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(responseWriter http.ResponseWriter, request *http.Request) {
		ctx := request.Context()
		ctx = internal.ContextWithAccountID(ctx, uuid.Nil.String())
		next.ServeHTTP(responseWriter, request.Clone(ctx))
	})
}

func TestConnection(t *testing.T) {
	Convey("TestConnection", t, func() {
		folderPath, err := os.MkdirTemp("testdata", "TestConnection-*")
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
		handlers := Handlers{
			EventLog: eventLog,
			ConnectionFactory: ConnectionFactory{
				ConnectionStore: make(store2.StoreInMemory[ConnectionStoreKey, *Connection]),
			},
		}
		router := mux.NewRouter()
		router.Use(MockAuthorizationMiddleware)
		router.HandleFunc("/clients/{client_id}/connections/{connection_id}", handlers.HandleConnection).Methods(http.MethodGet).Name("HandleConnection")
		router.HandleFunc("/sessions/{session_id}", handlers.StartSession).Methods(http.MethodPut).Name("StartSession")
		router.HandleFunc("/sessions/{session_id}", handlers.EndSession).Methods(http.MethodDelete).Name("EndSession")
		server := httptest.NewServer(router)
		defer server.Close()
		client := server.Client()
		Convey("open 2 client connections", func() {
			clientIDs := [2]string{uuid.NewV4().String(), uuid.NewV4().String()}
			connectionIDs := [2]string{uuid.NewV4().String(), uuid.NewV4().String()}
			var conns [2]*websocket.Conn
			incomingMessageCs := [2]chan *OutgoingMessage{
				make(chan *OutgoingMessage, 32),
				make(chan *OutgoingMessage, 32),
			}
			for i, clientID := range clientIDs {
				connectionID := connectionIDs[i]
				target, err := url.Parse(server.URL)
				So(err, ShouldBeNil)
				target.Scheme = "ws"
				target.Path = fmt.Sprintf("/clients/%s/connections/%s", clientID, connectionID)
				conn, _, err := websocket.DefaultDialer.Dial(target.String(), nil)
				So(err, ShouldBeNil)
				defer func() {
					err = conn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
					So(err, ShouldBeNil)
				}()
				conns[i] = conn
				go ReadIncomingMessages(conn, incomingMessageCs[i])
			}
			for _, incomingMessageC := range incomingMessageCs {
				for i := 0; i < len(incomingMessageCs); i++ {
					incomingMessage, err := ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
					So(err, ShouldBeNil)
					So(incomingMessage.Type, ShouldEqual, MessageTypeEvent)
					So(incomingMessage.Event, ShouldNotBeNil)
					So(incomingMessage.Event.Type, ShouldEqual, EventTypeClientConnected)
					var data ClientConnectedEventData
					err = json.Unmarshal(incomingMessage.Event.Data, &data)
					So(err, ShouldBeNil)
					So(data.ClientID, ShouldEqual, clientIDs[i])
					So(data.ConnectionID, ShouldEqual, connectionIDs[i])
				}
				_, err := ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
				So(err, ShouldEqual, ErrTimeout)
			}

			Convey("send signal from connection 1 to connection 2", func() {
				data, err := json.Marshal(uuid.NewV4().String())
				So(err, ShouldBeNil)
				outgoingMessage := IncomingMessage{
					Type: MessageTypeSignal,
					Signal: &IncomingSignal{
						ToConnectionID: connectionIDs[1],
						Data:           data,
					},
				}
				err = conns[0].WriteJSON(&outgoingMessage)
				So(err, ShouldBeNil)
				incomingMessageC := incomingMessageCs[1]
				incomingMessage, err := ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
				So(err, ShouldBeNil)
				So(incomingMessage.Type, ShouldEqual, MessageTypeSignal)
				So(incomingMessage.Signal, ShouldNotBeNil)
				So(incomingMessage.Signal.FromConnectionID, ShouldEqual, connectionIDs[0])
				So(incomingMessage.Signal.Data, ShouldResemble, json.RawMessage(data))

				_, err = ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
				So(err, ShouldEqual, ErrTimeout)
			})
			Convey("send signal from connection 2 to connection 1", func() {
				data, err := json.Marshal(uuid.NewV4().String())
				So(err, ShouldBeNil)
				outgoingMessage := IncomingMessage{
					Type: MessageTypeSignal,
					Signal: &IncomingSignal{
						ToConnectionID: connectionIDs[0],
						Data:           data,
					},
				}
				err = conns[1].WriteJSON(&outgoingMessage)
				So(err, ShouldBeNil)
				incomingMessageC := incomingMessageCs[0]
				incomingMessage, err := ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
				So(err, ShouldBeNil)
				So(incomingMessage.Type, ShouldEqual, MessageTypeSignal)
				So(incomingMessage.Signal, ShouldNotBeNil)
				So(incomingMessage.Signal.FromConnectionID, ShouldEqual, connectionIDs[1])
				So(incomingMessage.Signal.Data, ShouldResemble, json.RawMessage(data))

				_, err = ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
				So(err, ShouldEqual, ErrTimeout)
			})
			Convey("start a session hosted by connection 0", func() {
				sessionID := uuid.NewV4().String()
				sessionName := uuid.NewV4().String()
				sessionStart := time.Now()
				target, err := url.Parse(server.URL)
				So(err, ShouldBeNil)
				target.Path = fmt.Sprintf("/sessions/%s", sessionID)
				input := StartSessionEventData{
					ID:               sessionID,
					Name:             sessionName,
					HostConnectionID: connectionIDs[0],
					StartedAt:        sessionStart,
				}
				payload, err := json.Marshal(input)
				So(err, ShouldBeNil)
				request, err := http.NewRequest(http.MethodPut, target.String(), bytes.NewReader(payload))
				So(err, ShouldBeNil)
				response, err := client.Do(request)
				So(err, ShouldBeNil)
				So(response.StatusCode, ShouldEqual, http.StatusOK)
				Convey("read session started event from connection 1", func() {
					incomingMessageC := incomingMessageCs[1]
					incomingMessage, err := ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
					So(err, ShouldBeNil)
					So(incomingMessage.Type, ShouldEqual, MessageTypeEvent)
					So(incomingMessage.Event, ShouldNotBeNil)
					So(incomingMessage.Event.Type, ShouldEqual, EventTypeSessionStarted)
					var data StartSessionEventData
					err = json.Unmarshal(incomingMessage.Event.Data, &data)
					So(err, ShouldBeNil)
					So(data.ID, ShouldEqual, sessionID)
					So(data.Name, ShouldEqual, sessionName)
					So(data.HostConnectionID, ShouldEqual, connectionIDs[0])
					So(data.StartedAt, ShouldEqual, sessionStart)

					_, err = ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
					So(err, ShouldEqual, ErrTimeout)

					Convey("end the session", func() {
						target, err := url.Parse(server.URL)
						So(err, ShouldBeNil)
						target.Path = fmt.Sprintf("/sessions/%s", sessionID)
						request, err := http.NewRequest(http.MethodDelete, target.String(), nil)
						So(err, ShouldBeNil)
						response, err := client.Do(request)
						So(err, ShouldBeNil)
						So(response.StatusCode, ShouldEqual, http.StatusOK)
						Convey("read session ended event from connection 1", func() {
							incomingMessageC := incomingMessageCs[1]
							incomingMessage, err := ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
							So(err, ShouldBeNil)
							So(incomingMessage.Type, ShouldEqual, MessageTypeEvent)
							So(incomingMessage.Event, ShouldNotBeNil)
							So(incomingMessage.Event.Type, ShouldEqual, EventTypeSessionEnded)
							var data EndSessionEventData
							err = json.Unmarshal(incomingMessage.Event.Data, &data)
							So(err, ShouldBeNil)
							So(data.ID, ShouldEqual, sessionID)

							incomingMessage, err = ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
							PrintJSON(incomingMessage)
							So(err, ShouldEqual, ErrTimeout)
						})
					})
				})
			})
			Convey("Open a 3rd connection", func() {
				clientID := uuid.NewV4().String()
				connectionID := uuid.NewV4().String()
				Convey("With cursor 0", func() {
					target, err := url.Parse(server.URL)
					So(err, ShouldBeNil)
					target.Scheme = "ws"
					target.Path = fmt.Sprintf("/clients/%s/connections/%s", clientID, connectionID)
					conn, _, err := websocket.DefaultDialer.Dial(target.String(), nil)
					So(err, ShouldBeNil)
					incomingMessageC := make(chan *OutgoingMessage, 32)
					go ReadIncomingMessages(conn, incomingMessageC)
					for i := 0; i < len(conns); i++ {
						incomingMessage, err := ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
						So(err, ShouldBeNil)
						So(incomingMessage.Type, ShouldEqual, MessageTypeEvent)
						So(incomingMessage.Event, ShouldNotBeNil)
						So(incomingMessage.Event.Type, ShouldEqual, EventTypeClientConnected)
						var data ClientConnectedEventData
						err = json.Unmarshal(incomingMessage.Event.Data, &data)
						So(err, ShouldBeNil)
						So(data.ClientID, ShouldEqual, clientIDs[i])
						So(data.ConnectionID, ShouldEqual, connectionIDs[i])
					}
					incomingMessage, err := ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
					So(err, ShouldBeNil)
					So(incomingMessage.Type, ShouldEqual, MessageTypeEvent)
					So(incomingMessage.Event, ShouldNotBeNil)
					So(incomingMessage.Event.Type, ShouldEqual, EventTypeClientConnected)
					var data ClientConnectedEventData
					err = json.Unmarshal(incomingMessage.Event.Data, &data)
					So(err, ShouldBeNil)
					So(data.ClientID, ShouldEqual, clientID)
					So(data.ConnectionID, ShouldEqual, connectionID)

					_, err = ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
					So(err, ShouldEqual, ErrTimeout)
				})
				Convey("With cursor 2", func() {
					query := make(url.Values)
					query.Set("cursor", "2")
					target, err := url.Parse(server.URL)
					So(err, ShouldBeNil)
					target.Scheme = "ws"
					target.Path = fmt.Sprintf("/clients/%s/connections/%s", clientID, connectionID)
					target.RawQuery = query.Encode()
					conn, _, err := websocket.DefaultDialer.Dial(target.String(), nil)
					So(err, ShouldBeNil)
					incomingMessageC := make(chan *OutgoingMessage, 32)
					go ReadIncomingMessages(conn, incomingMessageC)
					incomingMessage, err := ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
					So(err, ShouldBeNil)
					So(incomingMessage.Type, ShouldEqual, MessageTypeEvent)
					So(incomingMessage.Event, ShouldNotBeNil)
					So(incomingMessage.Event.Type, ShouldEqual, EventTypeClientConnected)
					var data ClientConnectedEventData
					err = json.Unmarshal(incomingMessage.Event.Data, &data)
					So(err, ShouldBeNil)
					So(data.ClientID, ShouldEqual, clientID)
					So(data.ConnectionID, ShouldEqual, connectionID)

					_, err = ReadIncomingMessage(incomingMessageC, 10*time.Millisecond)
					So(err, ShouldEqual, ErrTimeout)
				})
			})
		})
	})
}

func ReadIncomingMessages(conn *websocket.Conn, incomingMessageC chan *OutgoingMessage) {
	for {
		var incomingMessage OutgoingMessage
		err := conn.ReadJSON(&incomingMessage)
		if err != nil {
			if websocket.IsCloseError(err, websocket.CloseNormalClosure) {
				return
			}
			log.Fatal(err)
		}
		incomingMessageC <- &incomingMessage
	}
}

var ErrTimeout = fmt.Errorf("timeout")

func ReadIncomingMessage(incomingMessageC chan *OutgoingMessage, timeout time.Duration) (incomingMessage *OutgoingMessage, err error) {
	select {
	case incomingMessage = <-incomingMessageC:
		return
	case <-time.After(timeout):
		err = ErrTimeout
		return
	}
}

func PrintJSON(v interface{}) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		panic(err)
	}
	fmt.Println(string(b))
}
