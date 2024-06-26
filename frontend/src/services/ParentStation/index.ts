import LoggingService from '../LoggingService';
import EventService from "../EventService";
import RecordingService from "./RecordingService";
import ProjectedSessionList from "./SessionListService/ProjectedListService";
import SessionService from "./SessionService";

interface NewParentStationInput {
    logging_service: LoggingService;
    signal_service: SignalService;
    event_service: EventService;
}

class ParentStation {
    readonly session_list_service: SessionListService;
    readonly session_service: ParentStationSessionService;
    readonly recording_service: RecordingService;

    constructor({ logging_service, signal_service, event_service }: NewParentStationInput) {
        this.session_list_service = new ProjectedSessionList({
            event_service,
        });
        this.session_service = new SessionService({
            logging_service,
            signal_service,
            session_list_service: this.session_list_service,
        });
        this.recording_service = new RecordingService({
            session_service: this.session_service,
        });
    }
}

export default ParentStation;