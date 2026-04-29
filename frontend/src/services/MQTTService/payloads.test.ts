import { new_webrtc_inbox_payload } from "./payloads";

describe("MQTTService payloads", () => {
    test("creates WebRTC description payload", () => {
        const description = {
            type: "answer",
        } as RTCSessionDescriptionInit;

        expect(new_webrtc_inbox_payload("client-1", { description })).toEqual({
            from_client_id: "client-1",
            type: "description",
            description,
        });
    });

    test("creates WebRTC candidate payload", () => {
        const candidate = {
            candidate: "candidate:1",
        } as RTCIceCandidateInit;

        expect(new_webrtc_inbox_payload("client-1", { candidate })).toEqual({
            from_client_id: "client-1",
            type: "candidate",
            candidate,
        });
    });
});
