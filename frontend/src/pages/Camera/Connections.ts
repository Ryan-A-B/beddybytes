import { Map } from "immutable";
import settings from "../../settings";
import { Signaler } from "../../Connection/Connection";

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
    private signaler: Signaler;
    private stream: MediaStream;
    private pcs: Map<string, RTCPeerConnection> = Map();
    constructor(signaler: Signaler, stream: MediaStream) {
        this.signaler = signaler;
        this.stream = stream;
        this.signaler.addEventListener("signal", this.onSignal);
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
        const pc = new RTCPeerConnection(settings.RTC);
        pc.onicecandidate = this.onICECandidate(signal.from_connection_id);
        this.pcs = this.pcs.set(signal.from_connection_id, pc);
        await pc.setRemoteDescription(signal.data.description);
        this.stream.getTracks().forEach((track) => pc.addTrack(track, this.stream));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.signaler.sendSignal({
            to_connection_id: signal.from_connection_id,
            data: { description: answer },
        });
    }

    private handleCandidateSignal = async (signal: IncomingSignalCandidate) => {
        const pc = this.pcs.get(signal.from_connection_id);
        if (pc === undefined) throw new Error(`PeerConnection is not found: ${signal.from_connection_id}`);
        const candidate = new RTCIceCandidate(signal.data.candidate);
        await pc.addIceCandidate(candidate);
    }

    private handleCloseSignal = (signal: IncomingSignalClose) => {
        this.closeExistingPeerConnectionIfAny(signal.from_connection_id);
    }

    private closeExistingPeerConnectionIfAny(peerConnectionID: string) {
        const existing = this.pcs.get(peerConnectionID);
        if (existing !== undefined) {
            existing.onicecandidate = null;
            existing.close();
        }
    }

    private onICECandidate = (peerConnectionID: string) => (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate === null) return;
        this.signaler.sendSignal({
            to_connection_id: peerConnectionID,
            data: { candidate: event.candidate },
        });
    }

    close = () => {
        this.pcs.forEach((pc) => {
            pc.close()
        });
        this.signaler.removeEventListener("signal", this.onSignal);
    }
}

export default Connections;
