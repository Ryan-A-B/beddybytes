import React from "react";
import { EventTypeHostSessionStatusChanged } from "../services/BabyStation/SessionService";
import baby_station from "../services/instances/baby_station";

const useHostSessionStatus = () => {
    const session_service = baby_station.session_service;
    const [hostSessionStatus, setHostSessionStatus] = React.useState<HostSessionStatus>(() => {
        return session_service.get_status();
    });
    React.useEffect(() => {
        const handle_host_session_status_changed = () => {
            setHostSessionStatus(session_service.get_status());
        };
        session_service.addEventListener(EventTypeHostSessionStatusChanged, handle_host_session_status_changed);
        return () => {
            session_service.removeEventListener(EventTypeHostSessionStatusChanged, handle_host_session_status_changed);
        }
    }, [session_service]);
    return hostSessionStatus;
}

export default useHostSessionStatus;
