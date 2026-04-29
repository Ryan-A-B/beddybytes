import { client_webrtc_inbox_topic, parse_client_status_topic } from "./topics";

describe("MQTTService topics", () => {
    test("creates client WebRTC inbox topic", () => {
        expect(client_webrtc_inbox_topic("account-1", "client-2")).toBe("accounts/account-1/clients/client-2/webrtc_inbox");
    });

    test("parses client status topic", () => {
        expect(parse_client_status_topic("accounts/account-1/clients/client-2/status")).toEqual({
            account_id: "account-1",
            client_id: "client-2",
        });
    });

    test("does not parse non-status client topic", () => {
        expect(parse_client_status_topic("accounts/account-1/clients/client-2/webrtc_inbox")).toBeNull();
    });
});
