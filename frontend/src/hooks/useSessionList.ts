import React from "react";
import { List } from "immutable";
import debounce from "../utils/debounce";
import parent_station from "../services/instances/parent_station";
import { EventTypeSessionListChanged } from "../services/ParentStation/SessionListService/ProjectedListService";

const useSessionList = () => {
    const session_list_service = parent_station.session_list_service;
    const [session_list, set_session_list] = React.useState<List<Session>>(() => {
        return session_list_service.get_session_list();
    });
    React.useEffect(() => {
        const handle_sessions_changed = debounce(() => {
            set_session_list(session_list_service.get_session_list());
        }, 50);
        session_list_service.addEventListener(EventTypeSessionListChanged, handle_sessions_changed);
        return () => {
            session_list_service.removeEventListener(EventTypeSessionListChanged, handle_sessions_changed);
        }
    }, [session_list_service]);
    return session_list;
}

export default useSessionList;