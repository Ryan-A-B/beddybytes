import { v4 as uuid } from 'uuid';
import Connection from "./Connection";
import { MessageHandler, MessageReceived, Subscription } from "./MQTTService";
import Service, { EventTypeStateChanged, ServiceState } from './Service';
import ConsoleLoggingService from './LoggingService/ConsoleLoggingService';

describe('Connection', () => {
    describe('initiate', () => {
        test('happy path', async () => {
            const peer_client_id = uuid();
            const mqtt_service = new MockMQTTService();
            const connection = Connection.initiate({
                logging_service: new ConsoleLoggingService(),
                mqtt_service: mqtt_service as any,
                peer_client_id,
            });
            expect(connection.peer_connection.addTransceiver).toHaveBeenCalledTimes(2);
            expect(connection.peer_connection.addTransceiver).toHaveBeenCalledWith('video', { direction: 'recvonly' });
            expect(connection.peer_connection.addTransceiver).toHaveBeenCalledWith('audio', { direction: 'recvonly' });
            expect(connection.peer_connection.setLocalDescription).toHaveBeenCalledTimes(1);
            expect(connection.peer_connection.setLocalDescription).toHaveBeenCalledWith();

            expect(connection.get_state().name).toBe('awaiting_answer');

            await Promise.resolve();
            expect(mqtt_service.publish_webrtc_description).toHaveBeenCalledTimes(1);
            expect(mqtt_service.publish_webrtc_description).toHaveBeenCalledWith(peer_client_id, { "type": "offer", sdp: "dummy_sdp" });

            const answer = { "type": "answer", sdp: "dummy_sdp" } as RTCSessionDescriptionInit;
            mqtt_service.dispatch_webrtc_message({
                from_client_id: peer_client_id,
                type: "description",
                description: answer,
            });
            expect(connection.peer_connection.setRemoteDescription).toHaveBeenCalledTimes(1);
            expect(connection.peer_connection.setRemoteDescription).toHaveBeenCalledWith(answer);
            expect(connection.get_state().name).toBe('accepting_description');

            await Promise.resolve();
            expect(connection.get_state().name).toBe('active');
        });
    });

    describe('accept_offer', () => {
        test('happy path', async () => {
            const peer_client_id = uuid();
            const mqtt_service = new MockMQTTService();
            const offer = { "type": "offer", sdp: "dummy_sdp" };
            const connection = Connection.accept_offer({
                logging_service: new ConsoleLoggingService(),
                mqtt_service: mqtt_service as any,
                peer_client_id,
                offer: offer as RTCSessionDescriptionInit,
            });

            expect(connection.peer_connection.setRemoteDescription).toHaveBeenCalledTimes(1);
            expect(connection.peer_connection.setRemoteDescription).toHaveBeenCalledWith(offer);
            expect(connection.get_state().name).toBe('accepting_description');

            await wait_for_state_change(connection);
            expect(connection.peer_connection.createAnswer).toHaveBeenCalledTimes(1);
            expect(connection.peer_connection.createAnswer).toHaveBeenCalledWith();
            expect(connection.peer_connection.setLocalDescription).toHaveBeenCalledTimes(1);
            expect(mqtt_service.publish_webrtc_description).toHaveBeenCalledTimes(1);
            expect(mqtt_service.publish_webrtc_description).toHaveBeenCalledWith(peer_client_id, { type: "answer", sdp: "dummy_sdp" });
            expect(connection.get_state().name).toBe('active');
        });

        test('ignores messages from other clients', async () => {
            const peer_client_id = uuid();
            const mqtt_service = new MockMQTTService();
            const connection = Connection.accept_offer({
                logging_service: new ConsoleLoggingService(),
                mqtt_service: mqtt_service as any,
                peer_client_id,
                offer: { "type": "offer", sdp: "dummy_sdp" } as RTCSessionDescriptionInit,
            });

            mqtt_service.dispatch_webrtc_message({
                from_client_id: "other-client",
                type: "candidate",
                candidate: { candidate: "candidate:1" },
            });

            expect(connection.peer_connection.addIceCandidate).not.toHaveBeenCalled();
        });

        test('handles candidates from peer', async () => {
            const peer_client_id = uuid();
            const mqtt_service = new MockMQTTService();
            const connection = Connection.accept_offer({
                logging_service: new ConsoleLoggingService(),
                mqtt_service: mqtt_service as any,
                peer_client_id,
                offer: { "type": "offer", sdp: "dummy_sdp" } as RTCSessionDescriptionInit,
            });
            await wait_for_state_change(connection);

            const candidate = { candidate: "candidate:1" };
            mqtt_service.dispatch_webrtc_message({
                from_client_id: peer_client_id,
                type: "candidate",
                candidate,
            });

            expect(connection.peer_connection.addIceCandidate).toHaveBeenCalledWith(candidate);
        });

        test('publishes ICE candidates through MQTT', () => {
            const peer_client_id = uuid();
            const mqtt_service = new MockMQTTService();
            const connection = Connection.accept_offer({
                logging_service: new ConsoleLoggingService(),
                mqtt_service: mqtt_service as any,
                peer_client_id,
                offer: { "type": "offer", sdp: "dummy_sdp" } as RTCSessionDescriptionInit,
            });
            const candidate = { candidate: "candidate:1" } as RTCIceCandidate;

            connection.peer_connection.dispatchEvent(Object.assign(new Event("icecandidate"), { candidate }));

            expect(mqtt_service.publish_webrtc_candidate).toHaveBeenCalledWith(peer_client_id, candidate);
        });

        test('closes MQTT subscription', () => {
            const mqtt_service = new MockMQTTService();
            const connection = Connection.accept_offer({
                logging_service: new ConsoleLoggingService(),
                mqtt_service: mqtt_service as any,
                peer_client_id: uuid(),
                offer: { "type": "offer", sdp: "dummy_sdp" } as RTCSessionDescriptionInit,
            });

            connection.close();

            expect(mqtt_service.subscription.close).toHaveBeenCalledTimes(1);
            expect(connection.peer_connection.close).toHaveBeenCalledTimes(1);
        });
    });
});

class MockMQTTService {
    public subscription = {
        topic_filter: "webrtc_inbox",
        callback: jest.fn(),
        test: jest.fn(),
        close: jest.fn(),
    } satisfies Subscription;
    private message_handler: Optional<MessageHandler> = null;

    subscribe_to_webrtc_inbox = jest.fn((message_handler: MessageHandler): Subscription => {
        this.message_handler = message_handler;
        return this.subscription;
    });

    publish_webrtc_description = jest.fn();
    publish_webrtc_candidate = jest.fn();

    dispatch_webrtc_message = (payload: unknown): void => {
        if (this.message_handler === null) throw new Error("missing message handler");
        this.message_handler(new MessageReceived("webrtc_inbox", JSON.stringify(payload)));
    }
}

class MockRTCPeerConnection extends EventTarget {
    localDescription: RTCLocalSessionDescriptionInit | null = null;
    remoteDescription: RTCSessionDescriptionInit | null = null;

    addTransceiver = jest.fn();
    addIceCandidate = jest.fn();
    close = jest.fn();

    setLocalDescription = jest.fn(async (description?: RTCLocalSessionDescriptionInit) => {
        if (description === undefined) {
            this.localDescription = {
                type: "offer",
                sdp: "dummy_sdp"
            };
            return;
        }
        this.localDescription = description;
    });

    setRemoteDescription = jest.fn(async (description: RTCSessionDescriptionInit) => {
        this.remoteDescription = description;
    });

    createAnswer = jest.fn(async () => {
        return {
            type: "answer",
            sdp: "dummy_sdp"
        } as RTCSessionDescriptionInit;
    });
}
(global as any).RTCPeerConnection = MockRTCPeerConnection;

async function wait_for_state_change<T extends ServiceState>(service: Service<T>): Promise<T> {
    return new Promise((resolve) => {
        service.addEventListener(EventTypeStateChanged, () => {
            resolve(service.get_state());
        });
    });
}
