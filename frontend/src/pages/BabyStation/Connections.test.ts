jest.mock("../../services/Connection", () => ({
    __esModule: true,
    default: {
        accept_offer: jest.fn(),
    },
}));

import Connection from "../../services/Connection";
import { MessageHandler, MessageReceived, Subscription } from "../../services/MQTTService";
import LoggingService, { LogInput } from "../../services/LoggingService";
import Connections from "./Connections";

const mock_accept_offer = Connection.accept_offer as jest.Mock;

describe("Connections", () => {
    beforeEach(() => {
        mock_accept_offer.mockReset();
    });

    test("subscribes to WebRTC inbox", () => {
        const mqtt_service = new MockMQTTService();

        new Connections({
            logging_service: new MockLoggingService(),
            mqtt_service: mqtt_service as any,
            audio_tracks: [],
            video_tracks: [],
        });

        expect(mqtt_service.subscribe_to_webrtc_inbox).toHaveBeenCalledTimes(1);
    });

    test("ignores candidate messages", async () => {
        const mqtt_service = new MockMQTTService();
        new Connections({
            logging_service: new MockLoggingService(),
            mqtt_service: mqtt_service as any,
            audio_tracks: [],
            video_tracks: [],
        });

        await mqtt_service.dispatch_webrtc_message({
            from_client_id: "client-1",
            type: "candidate",
            candidate: { candidate: "candidate:1" },
        });

        expect(mock_accept_offer).not.toHaveBeenCalled();
    });

    test("ignores non-offer descriptions", async () => {
        const mqtt_service = new MockMQTTService();
        new Connections({
            logging_service: new MockLoggingService(),
            mqtt_service: mqtt_service as any,
            audio_tracks: [],
            video_tracks: [],
        });

        await mqtt_service.dispatch_webrtc_message({
            from_client_id: "client-1",
            type: "description",
            description: { type: "answer" },
        });

        expect(mock_accept_offer).not.toHaveBeenCalled();
    });

    test("accepts first offer from a client and adds tracks", async () => {
        const mqtt_service = new MockMQTTService();
        const logging_service = new MockLoggingService();
        const audio_track = {} as MediaStreamTrack;
        const video_track = {} as MediaStreamTrack;
        const connection = new MockConnection();
        mock_accept_offer.mockReturnValue(connection);
        new Connections({
            logging_service,
            mqtt_service: mqtt_service as any,
            audio_tracks: [audio_track],
            video_tracks: [video_track],
        });
        const offer = { type: "offer", sdp: "dummy_sdp" } as RTCSessionDescriptionInit;

        await mqtt_service.dispatch_webrtc_message({
            from_client_id: "client-1",
            type: "description",
            description: offer,
        });

        expect(mock_accept_offer).toHaveBeenCalledWith({
            logging_service,
            mqtt_service,
            peer_client_id: "client-1",
            offer,
        });
        expect(connection.peer_connection.addTrack).toHaveBeenCalledWith(audio_track);
        expect(connection.peer_connection.addTrack).toHaveBeenCalledWith(video_track);
    });

    test("ignores offer from client that already has a connection", async () => {
        const mqtt_service = new MockMQTTService();
        mock_accept_offer.mockReturnValue(new MockConnection());
        new Connections({
            logging_service: new MockLoggingService(),
            mqtt_service: mqtt_service as any,
            audio_tracks: [],
            video_tracks: [],
        });
        const payload = {
            from_client_id: "client-1",
            type: "description",
            description: { type: "offer" },
        };

        await mqtt_service.dispatch_webrtc_message(payload);
        await mqtt_service.dispatch_webrtc_message(payload);

        expect(mock_accept_offer).toHaveBeenCalledTimes(1);
    });

    test("closes subscription and active connections", async () => {
        const mqtt_service = new MockMQTTService();
        const connection = new MockConnection();
        mock_accept_offer.mockReturnValue(connection);
        const connections = new Connections({
            logging_service: new MockLoggingService(),
            mqtt_service: mqtt_service as any,
            audio_tracks: [],
            video_tracks: [],
        });
        await mqtt_service.dispatch_webrtc_message({
            from_client_id: "client-1",
            type: "description",
            description: { type: "offer" },
        });

        connections.close();

        expect(connection.close).toHaveBeenCalledTimes(1);
        expect(mqtt_service.subscription.close).toHaveBeenCalledTimes(1);
    });
});

class MockConnection {
    public readonly peer_connection = {
        addTrack: jest.fn(),
    };

    public close = jest.fn();
}

class MockMQTTService {
    public readonly subscription = {
        topic_filter: "webrtc_inbox",
        callback: jest.fn(),
        test: jest.fn(),
        close: jest.fn(),
    } satisfies Subscription;
    private message_handler: Optional<MessageHandler> = null;

    public subscribe_to_webrtc_inbox = jest.fn((message_handler: MessageHandler): Subscription => {
        this.message_handler = message_handler;
        return this.subscription;
    });

    public dispatch_webrtc_message = async (payload: unknown): Promise<void> => {
        if (this.message_handler === null) throw new Error("missing message handler");
        await this.message_handler(new MessageReceived("webrtc_inbox", JSON.stringify(payload)));
    }
}

class MockLoggingService implements LoggingService {
    public readonly logs: LogInput[] = [];

    public set_account_id = jest.fn();

    public log = jest.fn((input: LogInput) => {
        this.logs.push(input);
    });
}
