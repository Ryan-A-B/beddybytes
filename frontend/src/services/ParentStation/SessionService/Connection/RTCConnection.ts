import settings from "../../../../settings";
import Service from "../../../Service";
import LoggingService, { Severity } from '../../../LoggingService';
import Connection, { ConnectionState, InitiatedBy } from ".";
import { Session } from "../../types";
import WebSocketSignalService, { SignalEvent } from "../../../SignalService/WebSocketSignalService";

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

const InitialState: ConnectionState = { state: 'new' };

interface NewRTCConnectionInput {
    logging_service: LoggingService;
    signal_service: WebSocketSignalService;
    session: Session;
    parent_station_media_stream: MediaStream;
}

class RTCConnection extends Service<ConnectionState> implements Connection {
    protected readonly name = 'RTCConnection';
    private signal_service: WebSocketSignalService;
    private session: Session;
    private media_stream: MediaStream;
    private peer_connection: RTCPeerConnection;

    constructor(input: NewRTCConnectionInput) {
        super({
            logging_service: input.logging_service,
            initial_state: InitialState,
        });
        this.signal_service = input.signal_service;
        this.session = input.session;
        this.peer_connection = this.create_peer_connection();
        this.send_description()
        this.signal_service.addEventListener("signal", this.handle_signal);
        this.media_stream = input.parent_station_media_stream;
    }

    protected to_string = (state: ConnectionState): string => {
        return state.state;
    }

    private create_peer_connection = (): RTCPeerConnection => {
        const peer_connection = new RTCPeerConnection(settings.RTC);
        peer_connection.addEventListener("icecandidate", this.handle_icecandidate_event);
        peer_connection.addEventListener("track", this.handle_track_event);
        peer_connection.addEventListener("connectionstatechange", this.handle_connectionstatechange_event);

        peer_connection.addEventListener("connectionstatechange", (event: Event) => {
            this.logging_service.log({
                severity: Severity.Debug,
                message: `connectionstatechange: ${peer_connection.connectionState}`,
            })
        });
        peer_connection.addEventListener("negotiationneeded", (event: Event) => {
            this.logging_service.log({
                severity: Severity.Debug,
                message: `negotiationneeded`,
            })
        });
        peer_connection.addEventListener("iceconnectionstatechange", (event: Event) => {
            this.logging_service.log({
                severity: Severity.Debug,
                message: `iceconnectionstatechange: ${peer_connection.iceConnectionState}`,
            })
        });
        peer_connection.addEventListener("icegatheringstatechange", (event: Event) => {
            this.logging_service.log({
                severity: Severity.Debug,
                message: `icegatheringstatechange: ${peer_connection.iceGatheringState}`,
            })
        });
        peer_connection.addEventListener("icecandidateerror", (event: Event) => {
            this.logging_service.log({
                severity: Severity.Debug,
                message: `icecandidateerror`,
            })
        });
        peer_connection.addEventListener("signalingstatechange", (event: Event) => {
            this.logging_service.log({
                severity: Severity.Debug,
                message: `signalingstatechange: ${peer_connection.signalingState}`,
            })
        });

        return peer_connection;
    }

    public get_rtc_peer_connection_state = (): RTCPeerConnectionState => {
        return this.peer_connection.connectionState;
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

    private handle_signal = async (event: SignalEvent) => {
        if (event.signal.from_connection_id !== this.session.host_connection_id) return;
        if (isDescriptionSignal(event.signal)) {
            await this.handle_answer_signal(event.signal);
            return
        }
        if (isCandidateSignal(event.signal)) {
            await this.handle_candidate_signal(event.signal);
            return
        }
    }

    private handle_answer_signal = async (signal: IncomingSignalDescription) => {
        if (signal.data.description.type !== "answer")
            throw new Error("data.description.type is not answer");
        const peer_connection = this.peer_connection;
        await peer_connection.setRemoteDescription(signal.data.description);
    }

    private handle_candidate_signal = async (signal: IncomingSignalCandidate) => {
        const candidate = new RTCIceCandidate(signal.data.candidate);
        await this.peer_connection.addIceCandidate(candidate);
    }

    private handle_icecandidate_event = (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate === null)
            return;
        this.signal_service.send_signal({
            to_connection_id: this.session.host_connection_id,
            data: { candidate: event.candidate },
        });
    }

    private handle_track_event = (event: RTCTrackEvent) => {
        // TODO is it bad to dispatch this event? I expected the browser to do it
        // but apparently the browser only dispatches it if the user agent does the addTrack
        // Maybe it isn't dodgy. The agent that adds the track is the agent that dispatches the event
        this.media_stream.addTrack(event.track);
        this.media_stream.dispatchEvent(new MediaStreamTrackEvent('addtrack', {
            track: event.track
        }));
        event.track.addEventListener("ended", () => {
            this.media_stream.removeTrack(event.track);
            this.media_stream.dispatchEvent(new MediaStreamTrackEvent('removetrack', {
                track: event.track
            }));
        }, { once: true });
    }

    private handle_connectionstatechange_event = (event: Event) => {
        const peer_connection_state = this.peer_connection.connectionState;
        switch (peer_connection_state) {
            case 'new':
                this.set_state({ state: 'new' });
                return;
            case 'connecting':
                this.set_state({ state: 'connecting' });
                return;
            case 'connected':
                this.set_state({ state: 'connected' });
                return;
            case 'disconnected':
                this.set_state({ state: 'disconnected' });
                return;
            case 'failed':
                const connection_state = this.get_state();
                if (connection_state.state === 'connecting') {
                    this.set_state({ state: 'unable_to_connect' });
                    return;
                }
                this.set_state({ state: 'failed' });
                return;
            case 'closed':
                this.set_state({ state: 'closed' });
                return;
            default:
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const _exhaustiveCheck: never = peer_connection_state;
                throw new TypeError(`unhandled peer_connection_state: ${peer_connection_state}`);
        }
    }

    public reconnect = () => {
        this.close_peer_connection();
        this.peer_connection = this.create_peer_connection();
        this.send_description();
        this.set_state(InitialState);
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
        this.peer_connection.removeEventListener("icecandidate", this.handle_icecandidate_event);
        this.peer_connection.removeEventListener("track", this.handle_track_event);
        this.peer_connection.removeEventListener("connectionstatechange", this.handle_connectionstatechange_event);
        this.peer_connection.close();
    }
}

export default RTCConnection;