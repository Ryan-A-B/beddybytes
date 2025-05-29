import Service from "../../../Service";
import LoggingService, { Severity } from '../../../LoggingService';
import { ConnectionState, InitiatedBy } from ".";
import { Session } from "../../types";
import WebSocketSignalService from "../../../SignalService/WebSocketSignalService";
import Connection from "../../../Connection";

const InitialState: ConnectionState = { state: 'new' };

interface NewRTCConnectionInput {
    logging_service: LoggingService;
    signal_service: WebSocketSignalService;
    session: Session;
    parent_station_media_stream: MediaStream;
}

class RTCConnection extends Service<ConnectionState> {
    protected readonly name = 'RTCConnection';
    private signal_service: WebSocketSignalService;
    private session: Session;
    private media_stream: MediaStream;
    private connection: Connection;

    constructor(input: NewRTCConnectionInput) {
        super({
            logging_service: input.logging_service,
            initial_state: InitialState,
        });
        this.signal_service = input.signal_service;
        this.session = input.session;
        this.connection = this.create_connection();
        this.media_stream = input.parent_station_media_stream;
    }

    protected to_string = (state: ConnectionState): string => {
        return state.state;
    }

    private create_connection = (): Connection => {
        const connection = Connection.initiate({
            logging_service: this.logging_service,
            signal_service: this.signal_service,
            other_connection_id: this.session.host_connection_id,
        });

        const peer_connection = connection.peer_connection;
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

        return connection;
    }

    public get_rtc_peer_connection_state = (): RTCPeerConnectionState => {
        return this.connection.peer_connection.connectionState;
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
        const peer_connection_state = this.connection.peer_connection.connectionState;
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
        this.close_connection();
        this.connection = this.create_connection();
        this.set_state(InitialState);
    }

    public close(initiatedBy: InitiatedBy) {
        if (initiatedBy === InitiatedBy.Client) {
            this.signal_service.send_signal({
                to_connection_id: this.session.host_connection_id,
                data: { close: null },
            });
        }
        this.close_connection();
    }

    private close_connection = () => {
        this.connection.peer_connection.removeEventListener("track", this.handle_track_event);
        this.connection.peer_connection.removeEventListener("connectionstatechange", this.handle_connectionstatechange_event);
        this.connection.close();
    }
}

export default RTCConnection;