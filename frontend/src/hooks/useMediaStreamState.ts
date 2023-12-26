import React from "react";
import { EventTypeRTCConnectionStreamStatusChanged } from "../services/ClientSessionService/RTCConnection";
import { ClientSessionState } from "../services/ClientSessionService/ClientSessionService";
import { MediaStreamState } from "../services/ClientSessionService/ClientConnection";

const useMediaStreamState = (client_session_state: ClientSessionState) => {
    const [status, set_status] = React.useState<MediaStreamState>(() => {
        if (client_session_state.state !== 'joined')
            return { state: 'not_available' };
        return client_session_state.client_connection.get_media_stream_state();
    });

    React.useEffect(() => {
        if (client_session_state.state !== 'joined') {
            set_status({ state: 'not_available' });
            return;
        }
        const connection = client_session_state.client_connection;
        const handle_rtc_connection_stream_status_changed = () => {
            set_status(connection.get_media_stream_state());
        }
        connection.addEventListener(EventTypeRTCConnectionStreamStatusChanged, handle_rtc_connection_stream_status_changed);
        return () => {
            connection.removeEventListener(EventTypeRTCConnectionStreamStatusChanged, handle_rtc_connection_stream_status_changed);
        }
    }, [client_session_state]);

    return status;
}

export default useMediaStreamState;
