package backendmqtt

import (
	"encoding/json"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestWebRTCInboxPayload(t *testing.T) {
	Convey("NewWebRTCInboxPayload", t, func() {
		Convey("sets type description for legacy session descriptions", func() {
			description := json.RawMessage(`{"type":"offer","sdp":"test-offer"}`)
			signalData := json.RawMessage(`{"description":{"type":"offer","sdp":"test-offer"}}`)

			payload := NewWebRTCInboxPayload("client-1", signalData)

			So(payload.FromClientID, ShouldEqual, "client-1")
			So(payload.Type, ShouldEqual, WebRTCInboxTypeDescription)
			So(string(payload.Description), ShouldEqual, string(description))
			So(payload.Candidate, ShouldBeNil)
			So(string(payload.SignalData()), ShouldEqual, string(signalData))
		})

		Convey("sets type candidate for ICE candidates", func() {
			signalData := json.RawMessage(`{"candidate":"candidate:1"}`)

			payload := NewWebRTCInboxPayload("client-1", signalData)

			So(payload.FromClientID, ShouldEqual, "client-1")
			So(payload.Type, ShouldEqual, WebRTCInboxTypeCandidate)
			So(payload.Description, ShouldBeNil)
			So(string(payload.Candidate), ShouldEqual, string(signalData))
			So(string(payload.SignalData()), ShouldEqual, string(signalData))
		})
	})

	Convey("SignalData", t, func() {
		Convey("wraps descriptions in legacy websocket signal data", func() {
			description := json.RawMessage(`{"type":"answer","sdp":"test-answer"}`)
			signalData := json.RawMessage(`{"description":{"type":"answer","sdp":"test-answer"}}`)

			payload := WebRTCInboxPayload{
				FromClientID: "client-1",
				Description:  description,
			}

			So(string(payload.SignalData()), ShouldEqual, string(signalData))
		})
	})
}
