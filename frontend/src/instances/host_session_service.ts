import HostSessionService from "../services/HostSessionService";
import authorization_service from "./authorization_service";

const host_session_service = new HostSessionService({
    authorization_service,
});

export default host_session_service;
