import React from "react";
import { EventTypeHostSessionStatusChanged, HostSessionStatus } from "../services/HostSessionService";
import host_session_service from "../instances/host_session_service";

const useHostSessionStatus = () => {
    const [hostSessionStatus, setHostSessionStatus] = React.useState<HostSessionStatus>(() => {
        return host_session_service.get_status();
    });
    React.useEffect(() => {
        const handle_host_session_status_changed = () => {
            setHostSessionStatus(host_session_service.get_status());
        };
        host_session_service.addEventListener(EventTypeHostSessionStatusChanged, handle_host_session_status_changed);
        return () => {
            host_session_service.removeEventListener(EventTypeHostSessionStatusChanged, handle_host_session_status_changed);
        }
    }, []);
    return hostSessionStatus;
}

export default useHostSessionStatus;
