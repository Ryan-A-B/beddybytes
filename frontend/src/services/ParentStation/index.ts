import LoggingService from '../LoggingService';
import RecordingService from "./RecordingService";
import SessionService from "./SessionService";
import { EventTypeSessionListChanged, SessionListService } from './SessionListService/types';
import SessionListServiceImpl from './SessionListService';
import MediaStreamTrackMonitor from './MediaStreamTrackMonitor';
import { EventTypeStateChanged } from '../Service';
import { EventTypeSignalStateChange } from '../SignalService/WebSocketSignalService';

interface NewParentStationInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
    signal_service: SignalService;
}

class ParentStation {
    readonly media_stream: MediaStream = new MediaStream();
    readonly signal_service: SignalService;
    readonly session_list_service: SessionListService;
    readonly session_service: SessionService;
    readonly media_stream_track_monitor: MediaStreamTrackMonitor;
    readonly recording_service: RecordingService;

    constructor({ logging_service, authorization_service, signal_service }: NewParentStationInput) {
        this.signal_service = signal_service;
        this.session_list_service = new SessionListServiceImpl({
            logging_service,
            authorization_service: authorization_service,
        });
        this.session_service = new SessionService({
            logging_service,
            signal_service,
            session_list_service: this.session_list_service,
            parent_station_media_stream: this.media_stream,
        });
        this.media_stream_track_monitor = new MediaStreamTrackMonitor({
            logging_service,
            media_stream: this.media_stream,
        });
        this.recording_service = new RecordingService({
            logging_service,
            session_service: this.session_service,
            media_stream: this.media_stream,
        });

        this.signal_service.addEventListener(EventTypeSignalStateChange, this.handle_signal_state_changed);
        this.session_list_service.addEventListener(EventTypeSessionListChanged, this.handle_session_list_changed);
        this.session_service.addEventListener(EventTypeStateChanged, this.handle_session_state_changed);
    }

    private handle_signal_state_changed = () => {
        this.reconnect_if_needed();
    }

    private handle_session_list_changed = () => {
        this.reconnect_if_needed();
    }

    private handle_session_state_changed = () => {
        this.reconnect_if_needed();
    }

    // TODO handle changes to connection

    private reconnect_if_needed = () => {
        const session_state = this.session_service.get_state();
        if (session_state.state !== 'joined') return;
        const connection = session_state.connection;
        const connection_state = connection.get_state();
        if (connection_state.state !== 'failed') return;
        const signal_state = this.signal_service.get_state();
        if (signal_state.state !== 'connected') return;
        const session_list = this.session_list_service.get_session_list();
        const session = session_list.find((session) => session.id === session_state.session.id);
        if (session === undefined) return;
        if (session.host_connection_state.state !== 'connected') return;
        connection.reconnect();
    }
}

export default ParentStation;