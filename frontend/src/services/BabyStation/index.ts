import MediaDevicePermissionService from "./MediaDevicePermissionService";
import MediaStreamService from "./MediaStreamService";
import SessionService from "./SessionService";

interface NewBabyStationInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

class BabyStation {
    readonly media_device_permission_service: MediaDevicePermissionService;
    readonly media_stream_service: MediaStreamService;
    readonly session_service: BabyStationSessionService;

    constructor(input: NewBabyStationInput) {
        this.media_device_permission_service = new MediaDevicePermissionService({
            logging_service: input.logging_service
        });
        this.media_stream_service = new MediaStreamService({
            logging_service: input.logging_service,
            media_device_permission_service: this.media_device_permission_service
        });
        this.session_service = new SessionService({
            logging_service: input.logging_service,
            authorization_service: input.authorization_service
        });
    }
}

export default BabyStation;