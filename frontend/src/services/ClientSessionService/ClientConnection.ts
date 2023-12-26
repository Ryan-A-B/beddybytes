import { InitiatedBy } from "./InitiatedBy";

interface MediaStreamStateNotAvailable {
    state: 'not_available';
}

interface MediaStreamStateAvailable {
    state: 'available';
    media_stream: MediaStream;
}

export type MediaStreamState = MediaStreamStateNotAvailable | MediaStreamStateAvailable;

interface ClientConnection extends EventTarget {
    get_rtc_peer_connection_state(): RTCPeerConnectionState;
    get_media_stream_state(): MediaStreamState;
    reconnect(): void;
    close(initiatedBy: InitiatedBy): void;
}

export default ClientConnection;