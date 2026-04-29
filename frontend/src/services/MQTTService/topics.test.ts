import { client_webrtc_inbox_topic } from "./topics";

describe("MQTTService topics", () => {
    test("creates client WebRTC inbox topic", () => {
        expect(client_webrtc_inbox_topic("account-1", "client-2")).toBe("accounts/account-1/clients/client-2/webrtc_inbox");
    });
});
