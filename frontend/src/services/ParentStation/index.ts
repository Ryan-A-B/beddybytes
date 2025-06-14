import LoggingService, { Severity } from '../LoggingService';
import RecordingService from "./RecordingService";
import SessionService from "./SessionService";
import MediaStreamTrackMonitor from './MediaStreamTrackMonitor';
import { EventTypeStateChanged } from '../Service';
import BabyStationListService from './BabyStationListService';
import WebSocketSignalService from '../SignalService/WebSocketSignalService';
import WakeLockService from '../WakeLockService';

interface NewParentStationInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
    signal_service: WebSocketSignalService;
    wake_lock_service: WakeLockService;
}

class ParentStation {
    readonly logging_service: LoggingService;
    readonly media_stream: MediaStream = new MediaStream();
    readonly signal_service: WebSocketSignalService;
    readonly baby_station_list_service: BabyStationListService;
    readonly session_service: SessionService;
    readonly media_stream_track_monitor: MediaStreamTrackMonitor;
    readonly recording_service: RecordingService;
    readonly wake_lock_service: WakeLockService;

    constructor({ logging_service, authorization_service, signal_service, wake_lock_service }: NewParentStationInput) {
        this.logging_service = logging_service;
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
        this.wake_lock_service = wake_lock_service;

        document.addEventListener('visibilitychange', this.handle_visibilitychange);
        this.signal_service.addEventListener(EventTypeStateChanged, this.handle_signal_state_changed);
        this.session_service.addEventListener(EventTypeStateChanged, this.handle_session_state_changed);
        this.baby_station_list_service.addEventListener(EventTypeStateChanged, this.handle_baby_station_list_changed);
    }

    public start = () => {
        this.signal_service.start();
        this.baby_station_list_service.start();
        this.wake_lock_service.lock();
    }

    public stop = () => {
        this.signal_service.stop();
        this.baby_station_list_service.stop();
        this.wake_lock_service.unlock();
    }

    private remove_connection_event_listener: (() => void) | null = null;
    private handle_signal_state_changed = () => {
        this.reconnect_if_needed();
        const session_state = this.session_service.get_state();
        if (session_state.name !== "joined") {
            if (this.remove_connection_event_listener === null) return;
            this.remove_connection_event_listener();
            this.remove_connection_event_listener = null;
            return;
        }
        const active_connection = session_state.get_active_connection()
        if (active_connection === null) throw new Error("No active connection but session is joined");
        active_connection.addEventListener(EventTypeStateChanged, this.handle_connection_state_changed);
        this.remove_connection_event_listener = () => active_connection.removeEventListener(EventTypeStateChanged, this.handle_connection_state_changed);
    }

    private handle_session_state_changed = () => {
        this.auto_connect_if_needed();
        this.reconnect_if_needed();
        this.auto_leave_session_if_needed();
        this.try_exit_picture_in_picture_if_needed();
    }

    private handle_baby_station_list_changed = () => {
        this.auto_connect_if_needed();
        this.reconnect_if_needed();
        this.auto_leave_session_if_needed();
    }

    private handle_visibilitychange = () => {
        this.auto_connect_if_needed();
    }

    private handle_connection_state_changed = () => {
        this.reconnect_if_needed();
        this.try_exit_picture_in_picture_if_needed();
    }

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

    private try_exit_picture_in_picture_if_needed = async () => {
        try {
            await this.exit_picture_in_picture_if_needed();
        } catch (error) {
            this.logging_service.log({
                severity: Severity.Warning,
                message: `Error exiting Picture-in-Picture: ${error instanceof Error ? error.message : String(error)}`,
            });
        }
    }

    private exit_picture_in_picture_if_needed = async () => {
        if (!document.pictureInPictureEnabled) return;
        if (!document.pictureInPictureElement) return;
        const session_state = this.session_service.get_state();
        if (session_state.name !== "joined") {
            await document.exitPictureInPicture();
            return;
        }
        const active_connection = session_state.get_active_connection();
        if (active_connection === null) throw new Error("No active connection but session is joined");
        const connection_state = active_connection.get_state();
        if (connection_state.state !== 'connected') {
            await document.exitPictureInPicture();
            return;
        }
    }
}

export default ParentStation;