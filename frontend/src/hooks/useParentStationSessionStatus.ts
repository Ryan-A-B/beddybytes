import React from "react";
import { EventTypeParentStationSessionStateChanged } from "../services/ParentStation/SessionService";
import parent_station from "../services/instances/parent_station";

const useParentStationSessionState = (): ParentStationSessionState => {
    const session_service = parent_station.session_service;
    const [state, set_state] = React.useState<ParentStationSessionState>(session_service.get_state);
    React.useEffect(() => {
        const handle_client_session_status_changed = () => {
            set_state(session_service.get_state());
        }
        session_service.addEventListener(EventTypeParentStationSessionStateChanged, handle_client_session_status_changed);
        return () => {
            session_service.removeEventListener(EventTypeParentStationSessionStateChanged, handle_client_session_status_changed);
        }
    }, [session_service]);
    return state;
}

export default useParentStationSessionState;
