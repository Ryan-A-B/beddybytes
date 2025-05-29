import LoggingService from '../LoggingService';
import MediaDevicePermissionService from "./MediaDevicePermissionService";
import MediaDeviceService from "./MediaDeviceService";
import SessionService from "./SessionService";

interface NewBabyStationInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

class BabyStation {
    readonly logging_service: LoggingService;
    readonly media_device_permission_service: MediaDevicePermissionService;
    readonly media_device_service: MediaDeviceService;
    readonly session_service: SessionService;

    constructor(input: NewBabyStationInput) {
        this.logging_service = input.logging_service;
        this.media_device_permission_service = new MediaDevicePermissionService({
            logging_service: input.logging_service
        });
        this.media_device_service = new MediaDeviceService({
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