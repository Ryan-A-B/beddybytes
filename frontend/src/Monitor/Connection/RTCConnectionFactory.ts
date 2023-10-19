import { Connection, ConnectionFactory } from ".";
import { Signaler } from "../../Connection/Connection";
import { Session } from "../../Sessions/Sessions";
import settings from "../../settings"

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

interface IncomingSignal {
    from_connection_id: string;
    data: {
        description?: RTCSessionDescriptionInit;
        candidate?: RTCIceCandidateInit;
    }
}

const isDescriptionSignal = (signal: IncomingSignal): signal is IncomingSignalDescription => {
    return signal.data.description !== undefined;
}

const isCandidateSignal = (signal: IncomingSignal): signal is IncomingSignalCandidate => {
    return signal.data.candidate !== undefined;
}

class RTCConnection implements Connection {
    private signaler: Signaler;
    private session: Session;
    private pc: RTCPeerConnection;
    constructor(signaler: Signaler, session: Session) {
        this.signaler = signaler;
        this.session = session;
        this.pc = new RTCPeerConnection(settings.RTC);
        this.pc.onicecandidate = this.onICECandidate;
        this.sendDescription()
        this.signaler.addEventListener("signal", this.onSignal);
    }

    private sendDescription = async () => {
        this.pc.addTransceiver('video', { direction: 'recvonly' })
        this.pc.addTransceiver('audio', { direction: 'recvonly' })
        await this.pc.setLocalDescription();
        this.signaler.sendSignal({
            to_connection_id: this.session.host_connection_id,
            data: { description: this.pc.localDescription },
        });
    }

    private onSignal = async (event: Event) => {
        if (!(event instanceof CustomEvent)) throw new Error("invalid event");
        const signal = event.detail as IncomingSignal;
        if (signal.from_connection_id !== this.session.host_connection_id) return;
        if (isDescriptionSignal(signal)) {
            await this.handleAnswer(signal);
            return
        }
        if (isCandidateSignal(signal)) {
            await this.handleCandidateSignal(signal);
            return
        }
    }

    private handleAnswer = async (signal: IncomingSignalDescription) => {
        if (signal.data.description.type !== "answer")
            throw new Error("data.description.type is not answer");
        await this.pc.setRemoteDescription(signal.data.description);
    }

    private handleCandidateSignal = async (signal: IncomingSignalCandidate) => {
        const candidate = new RTCIceCandidate(signal.data.candidate);
        await this.pc.addIceCandidate(candidate);
    }

    private onICECandidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate === null)
            return;
        this.signaler.sendSignal({
            to_connection_id: this.session.host_connection_id,
            data: { candidate: event.candidate },
        });
    }

    set onconnectionstatechange(connectionstatechange: (event: Event) => void) {
        this.pc.onconnectionstatechange = connectionstatechange;
    }

    set ontrack(ontrack: (event: RTCTrackEvent) => void) {
        this.pc.ontrack = ontrack;
    }

    close(initiatedByHost: boolean) {
        if (!initiatedByHost) {
            this.signaler.sendSignal({
                to_connection_id: this.session.host_connection_id,
                data: { close: null },
            });
        }
        this.signaler.removeEventListener("signal", this.onSignal);

        this.pc.onicecandidate = null;
        this.pc.ontrack = null;
        this.pc.onconnectionstatechange = null;
        this.pc.close();
    }
}

class RTCConnectionFactory implements ConnectionFactory {
    private signaler: Signaler;

    constructor(signaler: Signaler) {
        this.signaler = signaler;
    }

    create(session: Session): Connection {
        return new RTCConnection(this.signaler, session);
    }
}

export default RTCConnectionFactory;