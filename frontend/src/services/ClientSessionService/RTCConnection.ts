import settings from "../../settings";
import Severity from "../LoggingService/Severity";
import { Session } from "../SessionListService/types";
import { SignalService } from "../SignalService/types";
import ClientConnection, { MediaStreamState } from "./ClientConnection";
import { InitiatedBy } from "./InitiatedBy";

export const EventTypeRTCConnectionStateChanged = 'rtc_connection_state_changed';
export const EventTypeRTCConnectionStreamStatusChanged = 'rtc_connection_stream_status_changed';

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

interface NewRTCConnectionInput {
    logging_service: LoggingService;
    signal_service: SignalService;
    session: Session;
}

class RTCConnection extends EventTarget implements ClientConnection {
    private logging_service: LoggingService;
    private signal_service: SignalService;
    private session: Session;
    private peer_connection: RTCPeerConnection;
    private connection_stream_state: MediaStreamState = { state: 'not_available' };

    constructor(input: NewRTCConnectionInput) {
        super();
        this.logging_service = input.logging_service;
        this.signal_service = input.signal_service;
        this.session = input.session;
        this.peer_connection = this.create_peer_connection();
        this.send_description()
        this.signal_service.addEventListener("signal", this.handle_signal);
    }

    private create_peer_connection = (): RTCPeerConnection => {
        const peer_connection = new RTCPeerConnection(settings.RTC);
        peer_connection.onicecandidate = this.handle_ice_candidate;
        peer_connection.ontrack = this.handle_track;
        peer_connection.onconnectionstatechange = this.handle_connection_state_change;
        return peer_connection;
    }

    public get_rtc_peer_connection_state = (): RTCPeerConnectionState => {
        return this.peer_connection.connectionState;
    }

    public get_media_stream_state = (): MediaStreamState => {
        return this.connection_stream_state;
    }

    private set_connection_stream_state = (connection_stream_state: MediaStreamState): void => {
        this.logging_service.log({
            severity: Severity.Debug,
            message: `RTC stream state changed to ${connection_stream_state.state}`,
        })
        this.connection_stream_state = connection_stream_state;
        this.dispatchEvent(new Event(EventTypeRTCConnectionStreamStatusChanged));
    }

    private send_description = async () => {
        this.peer_connection.addTransceiver('video', { direction: 'recvonly' })
        this.peer_connection.addTransceiver('audio', { direction: 'recvonly' })
        await this.peer_connection.setLocalDescription();
        this.signal_service.send_signal({
            to_connection_id: this.session.host_connection_id,
            data: { description: this.peer_connection.localDescription },
        });
    }

    private handle_signal = async (event: Event) => {
        if (!(event instanceof CustomEvent)) throw new Error("invalid event");
        const signal = event.detail as IncomingSignal;
        if (signal.from_connection_id !== this.session.host_connection_id) return;
        if (isDescriptionSignal(signal)) {
            await this.handle_answer(signal);
            return
        }
        if (isCandidateSignal(signal)) {
            await this.handle_candidate_signal(signal);
            return
        }
    }

    private handle_answer = async (signal: IncomingSignalDescription) => {
        if (signal.data.description.type !== "answer")
            throw new Error("data.description.type is not answer");
        const peer_connection = this.peer_connection;
        await peer_connection.setRemoteDescription(signal.data.description);
    }

    private handle_candidate_signal = async (signal: IncomingSignalCandidate) => {
        const candidate = new RTCIceCandidate(signal.data.candidate);
        await this.peer_connection.addIceCandidate(candidate);
    }

    private handle_ice_candidate = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate === null)
            return;
        this.signal_service.send_signal({
            to_connection_id: this.session.host_connection_id,
            data: { candidate: event.candidate },
        });
    }

    private handle_track = (event: RTCTrackEvent) => {
        const stream = event.streams[0];
        this.set_connection_stream_state({ state: 'available', media_stream: stream });
    }

    private handle_connection_state_change = (event: Event) => {
        if (event.type !== "connectionstatechange")
            throw new Error("event.type is not connectionstatechange");
        this.logging_service.log({
            severity: Severity.Debug,
            message: `RTC connection state changed to ${this.peer_connection.connectionState}`,
        })
        this.dispatchEvent(new Event(EventTypeRTCConnectionStateChanged));
    }

    public reconnect = () => {
        this.close_peer_connection();
        this.peer_connection = this.create_peer_connection();
        this.send_description();
        this.dispatchEvent(new Event(EventTypeRTCConnectionStateChanged));
    }

    public close(initiatedBy: InitiatedBy) {
        if (initiatedBy === InitiatedBy.Client) {
            this.signal_service.send_signal({
                to_connection_id: this.session.host_connection_id,
                data: { close: null },
            });
        }
        this.signal_service.removeEventListener("signal", this.handle_signal);
        this.close_peer_connection();
    }

    private close_peer_connection = () => {
        this.peer_connection.onicecandidate = null;
        this.peer_connection.ontrack = null;
        this.peer_connection.onconnectionstatechange = null;
        this.peer_connection.close();
    }
}

export default RTCConnection;