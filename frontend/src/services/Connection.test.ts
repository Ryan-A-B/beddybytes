import { v4 as uuid } from 'uuid';
import Connection from "./Connection";
import { SignalEvent, SignalService } from "./SignalService/WebSocketSignalService";
import Service, { EventTypeStateChanged, ServiceState } from './Service';
import ConsoleLoggingService from './LoggingService/ConsoleLoggingService';

describe('Connection', () => {
    describe('initiate', () => {
        test('happy path', async () => {
            const other_connection_id = uuid();
            const signal_service = new MockSignalService();
            const connection = Connection.initiate({
                logging_service: new ConsoleLoggingService(),
                // @ts-ignore
                signal_service: signal_service,
                other_connection_id,
            });
            expect(connection.peer_connection.addTransceiver).toHaveBeenCalledTimes(2);
            expect(connection.peer_connection.addTransceiver).toHaveBeenCalledWith('video', { direction: 'recvonly' });
            expect(connection.peer_connection.addTransceiver).toHaveBeenCalledWith('audio', { direction: 'recvonly' });
            expect(connection.peer_connection.setLocalDescription).toHaveBeenCalledTimes(1);
            expect(connection.peer_connection.setLocalDescription).toHaveBeenCalledWith();

            expect(connection.get_state().name).toBe('awaiting_answer');

            await Promise.resolve();
            expect(signal_service.send_signal).toHaveBeenCalledTimes(1);
            expect(signal_service.send_signal).toHaveBeenCalledWith({
                to_connection_id: other_connection_id,
                data: {
                    description: { "type": "offer", sdp: "dummy_sdp" },
                }
            });

            const answer = { "type": "answer", sdp: "dummy_sdp" };
            signal_service.dispatchEvent(new SignalEvent({
                from_connection_id: other_connection_id,
                data: {
                    description: answer,
                }
            }));
            expect(connection.peer_connection.setRemoteDescription).toHaveBeenCalledTimes(1);
            expect(connection.peer_connection.setRemoteDescription).toHaveBeenCalledWith(answer);
            expect(connection.get_state().name).toBe('accepting_description');

            await Promise.resolve();
            expect(connection.get_state().name).toBe('active');
        });
    });

    describe('accept_offer', () => {
        test('happy path', async () => {
            const other_connection_id = uuid();
            const signal_service = new MockSignalService();
            const offer = { "type": "offer", sdp: "dummy_sdp" };
            const connection = Connection.accept_offer({
                logging_service: new ConsoleLoggingService(),
                // @ts-ignore
                signal_service: signal_service,
                other_connection_id,
                offer: offer as RTCSessionDescriptionInit,
            });

            expect(connection.peer_connection.setRemoteDescription).toHaveBeenCalledTimes(1);
            expect(connection.peer_connection.setRemoteDescription).toHaveBeenCalledWith(offer);
            expect(connection.get_state().name).toBe('accepting_description');

            await wait_for_state_change(connection);
            expect(connection.peer_connection.createAnswer).toHaveBeenCalledTimes(1);
            expect(connection.peer_connection.createAnswer).toHaveBeenCalledWith();
            expect(connection.peer_connection.setLocalDescription).toHaveBeenCalledTimes(1);
            expect(signal_service.send_signal).toHaveBeenCalledTimes(1);
            expect(connection.get_state().name).toBe('active');
        });
    });
});

// @ts-ignore
class MockSignalService extends EventTarget implements SignalService {
    send_signal = jest.fn();
}

class MockRTCPeerConnection extends EventTarget {
    localDescription: RTCLocalSessionDescriptionInit | null = null;
    remoteDescription: RTCSessionDescriptionInit | null = null;

    addTransceiver = jest.fn();

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