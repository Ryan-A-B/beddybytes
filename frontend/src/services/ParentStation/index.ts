import LoggingService from '../LoggingService';
import RecordingService from "./RecordingService";
import SessionService from "./SessionService";
import { SessionListService } from './SessionListService/types';
import SessionListServiceImpl from './SessionListService';
import MediaStreamTrackMonitor from './MediaStreamTrackMonitor';

interface NewParentStationInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
    signal_service: SignalService;
}

class ParentStation {
    readonly media_stream: MediaStream = new MediaStream();
    readonly session_list_service: SessionListService;
    readonly session_service: SessionService;
    readonly media_stream_track_monitor: MediaStreamTrackMonitor;
    readonly recording_service: RecordingService;

    constructor({ logging_service, authorization_service, signal_service }: NewParentStationInput) {
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
    }
}

export default ParentStation;