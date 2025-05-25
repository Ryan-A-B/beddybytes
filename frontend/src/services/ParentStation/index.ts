import LoggingService from '../LoggingService';
import RecordingService from "./RecordingService";
import SessionService from "./SessionService";
import MediaStreamTrackMonitor from './MediaStreamTrackMonitor';
import { EventTypeStateChanged } from '../Service';
import BabyStationListService from './BabyStationListService';
import WebSocketSignalService from '../SignalService/WebSocketSignalService';
import get_wake_locker from '../../WakeLock';

interface NewParentStationInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
    signal_service: WebSocketSignalService;
}

class ParentStation {
    readonly media_stream: MediaStream = new MediaStream();
    readonly signal_service: WebSocketSignalService;
    readonly baby_station_list_service: BabyStationListService;
    readonly session_service: SessionService;
    readonly media_stream_track_monitor: MediaStreamTrackMonitor;
    readonly recording_service: RecordingService;

    constructor({ logging_service, authorization_service, signal_service }: NewParentStationInput) {
        this.signal_service = signal_service;
        this.baby_station_list_service = new BabyStationListService({
            logging_service,
            authorization_service,
        });
        this.session_service = new SessionService({
            logging_service,
            signal_service,
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

        document.addEventListener('visibilitychange', this.handle_visibilitychange);
        this.signal_service.addEventListener(EventTypeStateChanged, this.handle_signal_state_changed);
        this.session_service.addEventListener(EventTypeStateChanged, this.handle_session_state_changed);
        this.baby_station_list_service.addEventListener(EventTypeStateChanged, this.handle_baby_station_list_changed);
    }

    public start = () => {
        this.signal_service.start();
        this.baby_station_list_service.start();
        get_wake_locker().lock();
    }

    public stop = () => {
        this.signal_service.stop();
        this.baby_station_list_service.stop();
        get_wake_locker().unlock();
    }

    private handle_signal_state_changed = () => {
        this.reconnect_if_needed();
    }

    private handle_session_state_changed = () => {
        this.auto_connect_if_needed();
        this.reconnect_if_needed();
        this.auto_leave_session_if_needed();
    }

    private handle_baby_station_list_changed = () => {
        this.auto_connect_if_needed();
        this.reconnect_if_needed();
        this.auto_leave_session_if_needed();
    }

    private handle_visibilitychange = () => {
        this.auto_connect_if_needed();
    }

    // TODO handle changes to connection

    private auto_connect_if_needed = () => {
        if (document.visibilityState !== 'visible') return;
        const session_state = this.session_service.get_state();
        if (session_state.name !== "not_joined") return;
        const baby_station_list = this.baby_station_list_service.get_baby_station_list();
        const baby_station = baby_station_list.first();
        if (baby_station === undefined) return;
        this.signal_service.start();
        this.session_service.join_session(baby_station.session);
    }

    private auto_leave_session_if_needed = () => {
        this.session_service.leave_session_if_ended(this.session_exists);
    }

    private reconnect_if_needed = () => {
        this.session_service.reconnect_if_needed(this.session_exists);
    }

    private session_exists = (session_id: string): boolean => {
        const snapshot = this.baby_station_list_service.get_snapshot();
        const session = snapshot.session_by_id.get(session_id);
        return session !== undefined;
    }
}

export default ParentStation;