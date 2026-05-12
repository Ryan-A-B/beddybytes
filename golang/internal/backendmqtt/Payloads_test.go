package backendmqtt

import (
	"encoding/json"
	"testing"

	. "github.com/smartystreets/goconvey/convey"
)

func TestWebRTCInboxPayload(t *testing.T) {
	Convey("NewWebRTCInboxPayload", t, func() {
		Convey("sets type description for session descriptions", func() {
			signalData := json.RawMessage(`{"type":"offer","sdp":"test-offer"}`)

			payload := NewWebRTCInboxPayload("client-1", signalData)

			So(payload.FromClientID, ShouldEqual, "client-1")
			So(payload.Type, ShouldEqual, WebRTCInboxTypeDescription)
			So(string(payload.Description), ShouldEqual, string(signalData))
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
		Convey("supports legacy payloads without a type", func() {
			signalData := json.RawMessage(`{"type":"answer","sdp":"test-answer"}`)

			payload := WebRTCInboxPayload{
				FromClientID: "client-1",
				Description:  signalData,
			}

			So(string(payload.SignalData()), ShouldEqual, string(signalData))
		})
	})
}
