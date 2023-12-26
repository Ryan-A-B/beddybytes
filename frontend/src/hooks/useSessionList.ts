import React from "react";
import { List } from "immutable";
import { EventTypeSessionListChanged } from "../services/SessionListService/ProjectedListService";
import debounce from "../utils/debounce";
import { useSessionListService } from "../services";
import { Session } from "../services/SessionListService/types";

const useSessionList = () => {
    const session_list_service = useSessionListService();
    const [sessionList, setSessionList] = React.useState<List<Session>>(() => {
        return session_list_service.get_session_list();
    });
    React.useEffect(() => {
        const handle_sessions_changed = debounce(() => {
            setSessionList(session_list_service.get_session_list());
        }, 50);
        session_list_service.addEventListener(EventTypeSessionListChanged, handle_sessions_changed);
        return () => {
            session_list_service.removeEventListener(EventTypeSessionListChanged, handle_sessions_changed);
        }
    }, [session_list_service]);
    return sessionList;
}

export default useSessionList;