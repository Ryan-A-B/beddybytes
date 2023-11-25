import { Signaler } from "../../Connection/Connection";
import { Session } from "../SessionListService";
import settings from "../../settings";

export const EventTypeRTCConnectionStateChanged = 'rtc_connection_state_changed';
export const EventTypeRTCConnectionStreamStatusChanged = 'rtc_connection_stream_status_changed';

interface RTCConnectionStreamStatusNotAvailable {
    status: 'not_available';
}

interface RTCConnectionStreamStatusAvailable {
    status: 'available';
    stream: MediaStream;
}

export type RTCConnectionStreamStatus = RTCConnectionStreamStatusNotAvailable | RTCConnectionStreamStatusAvailable;

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

class RTCConnection extends EventTarget {
    private signaler: Signaler;
    private session: Session;
    private pc: RTCPeerConnection;
    private stream_status: RTCConnectionStreamStatus = { status: 'not_available' };

    constructor(signaler: Signaler, session: Session) {
        super();
        this.signaler = signaler;
        this.session = session;
        this.pc = new RTCPeerConnection(settings.RTC);
        this.pc.onicecandidate = this.onICECandidate;
        this.pc.ontrack = this.onTrack;
        this.pc.onconnectionstatechange = this.onConnectionStateChange;
        this.sendDescription()
        this.signaler.addEventListener("signal", this.onSignal);
    }

    public get_connection_status = (): RTCPeerConnectionState => {
        return this.pc.connectionState;
    }

    public get_stream_status = (): RTCConnectionStreamStatus => {
        return this.stream_status;
    }

    private set_stream_status = (stream_status: RTCConnectionStreamStatus): void => {
        this.stream_status = stream_status;
        this.dispatchEvent(new Event(EventTypeRTCConnectionStreamStatusChanged));
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

    private onTrack = (event: RTCTrackEvent) => {
        const stream = event.streams[0];
        this.set_stream_status({ status: 'available', stream });
    }

    private onConnectionStateChange = (event: Event) => {
        if (event.type !== "connectionstatechange") throw new Error("event.type is not connectionstatechange");
        if (this.pc.connectionState === "disconnected") {
            this.set_stream_status({ status: 'not_available' });
        }
        this.dispatchEvent(new Event(EventTypeRTCConnectionStateChanged));
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

export default RTCConnection;