import HostSessionService from "../services/HostSessionService";
import influx_logging_service from "./logging_service";
import authorization_service from "./authorization_service";

const host_session_service = new HostSessionService({
    logging_service: influx_logging_service,
    authorization_service,
});

export default host_session_service;
