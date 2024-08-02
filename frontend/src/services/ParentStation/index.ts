import LoggingService from '../LoggingService';
import RecordingService from "./RecordingService";
import SessionService from "./SessionService";
import { SessionListService } from './SessionListService/types';
import SessionListServiceImpl from './SessionListService';

interface NewParentStationInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
    signal_service: SignalService;
}

class ParentStation {
    readonly session_list_service: SessionListService;
    readonly session_service: ParentStationSessionService;
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
        });
        this.recording_service = new RecordingService({
            session_service: this.session_service,
        });
    }
}

export default ParentStation;