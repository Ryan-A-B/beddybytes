import React from "react";
import { EventTypeHostSessionStatusChanged, HostSessionStatus } from "../services/HostSessionService";
import { useHostSessionService } from "../services";

const useHostSessionStatus = () => {
    const host_session_service = useHostSessionService();
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
    }, [host_session_service]);
    return hostSessionStatus;
}

export default useHostSessionStatus;
