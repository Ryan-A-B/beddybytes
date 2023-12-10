import ClientSessionService from "../services/ClientSessionService";
import logging_service from "./logging_service";
import signal_service from "./signal_service";
import session_list_service from "./session_list_service";

const client_session_service = new ClientSessionService({
    logging_service,
    signal_service,
    session_list_service,
});

export default client_session_service;