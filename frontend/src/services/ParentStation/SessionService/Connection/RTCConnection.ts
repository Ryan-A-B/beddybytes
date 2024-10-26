import settings from "../../../../settings";
import LoggingService, { Severity } from '../../../LoggingService';
import { Session } from "../../SessionListService/types";
import { InitiatedBy } from "./InitiatedBy";

export const EventTypeRTCConnectionStateChanged = 'rtc_connection_state_changed';

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
    parent_station_media_stream: MediaStream;
}

class RTCConnection extends EventTarget implements Connection {
    private logging_service: LoggingService;
    private signal_service: SignalService;
    private session: Session;
    private peer_connection: RTCPeerConnection;
    private media_stream: MediaStream;

    constructor(input: NewRTCConnectionInput) {
        super();
        this.logging_service = input.logging_service;
        this.signal_service = input.signal_service;
        this.session = input.session;
        this.peer_connection = this.create_peer_connection();
        this.send_description()
        this.signal_service.addEventListener("signal", this.handle_signal);
        this.media_stream = input.parent_station_media_stream;
    }

    private create_peer_connection = (): RTCPeerConnection => {
        const peer_connection = new RTCPeerConnection(settings.RTC);
        peer_connection.addEventListener("icecandidate", this.handle_icecandidate_event);
        peer_connection.addEventListener("track", this.handle_track_event);
        peer_connection.addEventListener("connectionstatechange", this.handle_connectionstatechange_event);

        peer_connection.addEventListener("connectionstatechange", (event: Event) => {
            console.log('connectionstatechange', event);
        });
        peer_connection.addEventListener("negotiationneeded", (event: Event) => {
            console.log('negotiationneeded', event);
        });
        peer_connection.addEventListener("iceconnectionstatechange", (event: Event) => {
            console.log('iceconnectionstatechange', event);
        });
        peer_connection.addEventListener("icegatheringstatechange", (event: Event) => {
            console.log('icegatheringstatechange', event);
        });
        peer_connection.addEventListener("icecandidateerror", (event: Event) => {
            console.log('icecandidateerror', event);
        });
        peer_connection.addEventListener("signalingstatechange", (event: Event) => {
            console.log('signalingstatechange', event);
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

    private handle_signal = async (event: Event) => {
        if (!(event instanceof CustomEvent)) throw new Error("invalid event");
        const signal = event.detail as IncomingSignal;
        if (signal.from_connection_id !== this.session.host_connection_id) return;
        if (isDescriptionSignal(signal)) {
            await this.handle_answer_signal(signal);
            return
        }
        if (isCandidateSignal(signal)) {
            await this.handle_candidate_signal(signal);
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
        this.peer_connection.removeEventListener("icecandidate", this.handle_icecandidate_event);
        this.peer_connection.removeEventListener("track", this.handle_track_event);
        this.peer_connection.removeEventListener("connectionstatechange", this.handle_connectionstatechange_event);
        this.peer_connection.close();
    }
}

export default RTCConnection;