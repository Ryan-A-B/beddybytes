import { Map } from "immutable";
import WebSocketSignalService, { IncomingSignal, SignalEvent } from "../../services/SignalService/WebSocketSignalService";
import Connection from "../../services/Connection";
import LoggingService from "../../services/LoggingService";

interface IncomingSignalDescription {
    from_connection_id: string;
    data: {
        description: RTCSessionDescriptionInit;
    }
}

interface IncomingSignalClose {
    from_connection_id: string;
    data: {
        close: null;
    }
}

const isDescriptionSignal = (signal: IncomingSignal): signal is IncomingSignalDescription => {
    return signal.data.description !== undefined;
}

const isCloseSignal = (signal: IncomingSignal): signal is IncomingSignalClose => {
    return signal.data.close !== undefined;
}

interface NewConnectionsInput {
    logging_service: LoggingService;
    signal_service: WebSocketSignalService;
    audio_tracks: MediaStreamTrack[];
    video_tracks: MediaStreamTrack[];
}

class Connections {
    private logging_service: LoggingService;
    private signal_service: WebSocketSignalService;
    private audio_tracks: MediaStreamTrack[];
    private video_tracks: MediaStreamTrack[];
    private connections: Map<string, Connection> = Map();

    constructor(input: NewConnectionsInput) {
        this.logging_service = input.logging_service;
        this.signal_service = input.signal_service;
        this.audio_tracks = input.audio_tracks;
        this.video_tracks = input.video_tracks;
        this.signal_service.start();
        this.signal_service.addEventListener("signal", this.handle_signal);
    }

    private handle_signal = async (event: SignalEvent) => {
        if (isDescriptionSignal(event.signal)) {
            await this.handleOffer(event.signal);
            return
        }
        if (isCloseSignal(event.signal)) {
            this.handleCloseSignal(event.signal);
            return
        }
    }

    private handleOffer = async (signal: IncomingSignalDescription) => {
        if (signal.data.description.type !== "offer")
            throw new Error("data.description.type is not offer");
        this.closeExistingPeerConnectionIfAny(signal.from_connection_id);
        const connection = Connection.accept_offer({
            logging_service: this.logging_service,
            signal_service: this.signal_service,
            other_connection_id: signal.from_connection_id,
            offer: signal.data.description,
        });
        this.connections = this.connections.set(signal.from_connection_id, connection);
        this.audio_tracks.forEach((track) => connection.peer_connection.addTrack(track));
        this.video_tracks.forEach((track) => connection.peer_connection.addTrack(track));
    }

    private handleCloseSignal = (signal: IncomingSignalClose) => {
        this.closeExistingPeerConnectionIfAny(signal.from_connection_id);
    }

    private closeExistingPeerConnectionIfAny(peerConnectionID: string) {
        const connection = this.connections.get(peerConnectionID);
        if (connection === undefined) return;
        connection.close();
    }

    close = () => {
        this.connections.forEach((connection) => {
            connection.close()
        });
        this.signal_service.stop();
        this.signal_service.removeEventListener("signal", this.handle_signal);
    }
}

export default Connections;
