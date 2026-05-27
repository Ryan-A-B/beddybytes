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
			So(payload.SignalData().Description, ShouldResemble, description)
			So(payload.SignalData().Candidate, ShouldBeNil)
		})

		Convey("sets type candidate for legacy ICE candidates", func() {
			candidate := json.RawMessage(`{"candidate":"candidate:1"}`)
			signalData := json.RawMessage(`{"candidate":{"candidate":"candidate:1"}}`)

			payload := NewWebRTCInboxPayload("client-1", signalData)

			So(payload.FromClientID, ShouldEqual, "client-1")
			So(payload.Type, ShouldEqual, WebRTCInboxTypeCandidate)
			So(payload.Description, ShouldBeNil)
			So(string(payload.Candidate), ShouldEqual, string(candidate))
			So(payload.SignalData().Description, ShouldBeNil)
			So(payload.SignalData().Candidate, ShouldResemble, candidate)
		})
	})

	Convey("SignalData", t, func() {
		Convey("wraps descriptions in legacy websocket signal data", func() {
			description := json.RawMessage(`{"type":"answer","sdp":"test-answer"}`)

			payload := WebRTCInboxPayload{
				FromClientID: "client-1",
				Type:         WebRTCInboxTypeDescription,
				Description:  description,
			}

			So(payload.SignalData().Description, ShouldResemble, description)
			So(payload.SignalData().Candidate, ShouldBeNil)
		})

		Convey("wraps candidates in legacy websocket signal data", func() {
			candidate := json.RawMessage(`{"candidate":"candidate:1"}`)

			payload := WebRTCInboxPayload{
				FromClientID: "client-1",
				Type:         WebRTCInboxTypeCandidate,
				Candidate:    candidate,
			}

			So(payload.SignalData().Description, ShouldBeNil)
			So(payload.SignalData().Candidate, ShouldResemble, candidate)
		})
	})
}
