package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"
	"time"

	"github.com/Ryan-A-B/beddybytes/backend/internal"
	"github.com/Ryan-A-B/beddybytes/backend/internal/eventlog"
	"github.com/Ryan-A-B/beddybytes/backend/internal/store2"
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
			}
			// TODO remove this sleep - appending to event log is causing a delay
			time.Sleep(20 * time.Millisecond)
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
				conns[1].SetReadDeadline(time.Now().Add(10 * time.Millisecond))
				var incomingMessage OutgoingMessage
				err = conns[1].ReadJSON(&incomingMessage)
				So(err, ShouldBeNil)
				So(incomingMessage.Type, ShouldEqual, MessageTypeSignal)
				So(incomingMessage.Signal, ShouldNotBeNil)
				So(incomingMessage.Signal.FromConnectionID, ShouldEqual, connectionIDs[0])
				So(incomingMessage.Signal.Data, ShouldResemble, json.RawMessage(data))
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
				conns[0].SetReadDeadline(time.Now().Add(10 * time.Millisecond))
				var incomingMessage OutgoingMessage
				err = conns[0].ReadJSON(&incomingMessage)
				So(err, ShouldBeNil)
				So(incomingMessage.Type, ShouldEqual, MessageTypeSignal)
				So(incomingMessage.Signal, ShouldNotBeNil)
				So(incomingMessage.Signal.FromConnectionID, ShouldEqual, connectionIDs[1])
				So(incomingMessage.Signal.Data, ShouldResemble, json.RawMessage(data))
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
				Convey("end the session", func() {
					target, err := url.Parse(server.URL)
					So(err, ShouldBeNil)
					target.Path = fmt.Sprintf("/sessions/%s", sessionID)
					request, err := http.NewRequest(http.MethodDelete, target.String(), nil)
					So(err, ShouldBeNil)
					response, err := client.Do(request)
					So(err, ShouldBeNil)
					So(response.StatusCode, ShouldEqual, http.StatusOK)
				})
			})
		})
	})
}
