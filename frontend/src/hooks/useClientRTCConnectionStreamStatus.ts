import React from "react";
import { ClientSessionStatus } from "../services/ClientSessionService";
import { RTCConnectionStreamStatus, EventTypeRTCConnectionStreamStatusChanged } from "../services/ClientSessionService/RTCConnection";

const useClientRTCConnectionStreamStatus = (client_session_status: ClientSessionStatus) => {
    const [status, set_status] = React.useState<RTCConnectionStreamStatus>(() => {
        if (client_session_status.status !== 'joined')
            return { status: 'not_available' };
        return client_session_status.rtc_connection.get_stream_status();
    });

    React.useEffect(() => {
        if (client_session_status.status !== 'joined') {
            set_status({ status: 'not_available' });
            return;
        }
        const connection = client_session_status.rtc_connection;
        const handle_rtc_connection_stream_status_changed = () => {
            set_status(connection.get_stream_status());
        }
        connection.addEventListener(EventTypeRTCConnectionStreamStatusChanged, handle_rtc_connection_stream_status_changed);
        return () => {
            connection.removeEventListener(EventTypeRTCConnectionStreamStatusChanged, handle_rtc_connection_stream_status_changed);
        }
    }, [client_session_status]);

    return status;
}

export default useClientRTCConnectionStreamStatus;
