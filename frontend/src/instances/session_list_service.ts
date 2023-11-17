import SessionListService from "../services/SessionListService";
import event_service from "./event_service";

const session_list_service = new SessionListService({
    event_service,
});

export default session_list_service;
