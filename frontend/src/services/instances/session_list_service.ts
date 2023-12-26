import ProjectedSessionList from "../SessionListService";
import event_service from "./event_service";

const session_list_service = new ProjectedSessionList({
    event_service,
});

export default session_list_service;
