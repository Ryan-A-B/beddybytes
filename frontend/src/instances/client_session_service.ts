import ClientSessionService from "../services/ClientSessionService";
import connection_service from "./connection_service";
import session_list_service from "./session_list_service";

const client_session_service = new ClientSessionService({
    connection_service,
    session_list_service,
});

export default client_session_service;