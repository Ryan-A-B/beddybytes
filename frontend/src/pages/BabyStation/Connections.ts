import { Map } from "immutable";
import settings from "../../settings";

interface IncomingSignalDescription {
    from_connection_id: string;
    data: {
        description: RTCSessionDescriptionInit;
    }
}

interface IncomingSignalCandidate {
    from_connection_id: string;
    data: {
        candidate: RTCIceCandidateInit;
    }
}

interface IncomingSignalClose {
    from_connection_id: string;
    data: {
        close: null;
    }
}

interface IncomingSignal {
    from_connection_id: string;
    data: {
        description?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidateInit;
        close?: null;
    }
}

const isDescriptionSignal = (signal: IncomingSignal): signal is IncomingSignalDescription => {
    return signal.data.description !== undefined;
}

const isCandidateSignal = (signal: IncomingSignal): signal is IncomingSignalCandidate => {
    return signal.data.candidate !== undefined;
}

const isCloseSignal = (signal: IncomingSignal): signal is IncomingSignalClose => {
    return signal.data.close !== undefined;
}

class Connections {
    private signal_service: SignalService;
    private stream: MediaStream;
    private peer_connections: Map<string, RTCPeerConnection> = Map();
    constructor(signal_service: SignalService, stream: MediaStream) {
        this.signal_service = signal_service;
        this.stream = stream;
        this.signal_service.start();
        this.signal_service.addEventListener("signal", this.onSignal);
    }

    private onSignal = async (event: Event) => {
        if (!(event instanceof CustomEvent)) throw new Error("invalid event");
        const signal = event.detail as IncomingSignal;
        if (isDescriptionSignal(signal)) {
            await this.handleOffer(signal);
            return
        }
        if (isCandidateSignal(signal)) {
            await this.handleCandidateSignal(signal);
            return
        }
        if (isCloseSignal(signal)) {
            this.handleCloseSignal(signal);
            return
        }
    }

    private handleOffer = async (signal: IncomingSignalDescription) => {
        if (signal.data.description.type !== "offer")
            throw new Error("data.description.type is not offer");
        this.closeExistingPeerConnectionIfAny(signal.from_connection_id);
        const peer_connection = new RTCPeerConnection(settings.RTC);
        peer_connection.onicecandidate = this.onICECandidate(signal.from_connection_id);
        this.peer_connections = this.peer_connections.set(signal.from_connection_id, peer_connection);
        await peer_connection.setRemoteDescription(signal.data.description);
        this.stream.getTracks().forEach((track) => peer_connection.addTrack(track, this.stream));
        const answer = await peer_connection.createAnswer();
        await peer_connection.setLocalDescription(answer);
        this.signal_service.send_signal({
            to_connection_id: signal.from_connection_id,
            data: { description: answer },
        });
    }

    private handleCandidateSignal = async (signal: IncomingSignalCandidate) => {
        const peer_connection = this.peer_connections.get(signal.from_connection_id);
        if (peer_connection === undefined) throw new Error(`PeerConnection is not found: ${signal.from_connection_id}`);
        const candidate = new RTCIceCandidate(signal.data.candidate);
        await peer_connection.addIceCandidate(candidate);
    }

    private handleCloseSignal = (signal: IncomingSignalClose) => {
        this.closeExistingPeerConnectionIfAny(signal.from_connection_id);
    }

    private closeExistingPeerConnectionIfAny(peerConnectionID: string) {
        const peer_connection = this.peer_connections.get(peerConnectionID);
        if (peer_connection === undefined) return;
        peer_connection.onicecandidate = null;
        peer_connection.close();
    }

    private onICECandidate = (peerConnectionID: string) => (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate === null) return;
        this.signal_service.send_signal({
            to_connection_id: peerConnectionID,
            data: { candidate: event.candidate },
        });
    }

    close = () => {
        this.peer_connections.forEach((peer_connection) => {
            peer_connection.close()
        });
        this.signal_service.stop();
        this.signal_service.removeEventListener("signal", this.onSignal);
    }
}

export default Connections;
