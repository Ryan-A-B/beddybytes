import React from "react";
import { List } from "immutable";
import debounce from "../utils/debounce";
import { useSessionListService } from "../services";
import { EventTypeSessionListChanged, Session } from "../services/SessionListService/types";

const useSessionList = () => {
    const session_list_service = useSessionListService();
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