interface MediaStreamStateNotAvailable {
    state: 'not_available';
}

interface MediaStreamStateAvailable {
    state: 'available';
    media_stream: MediaStream;
}

type MediaStreamState = MediaStreamStateNotAvailable | MediaStreamStateAvailable;

type InitiatedByHost = 0;
type InitiatedByClient = 1;

type InitiatedBy = InitiatedByHost | InitiatedByClient;

interface Connection extends EventTarget {
    get_rtc_peer_connection_state(): RTCPeerConnectionState;
    get_media_stream_state(): MediaStreamState;
    reconnect(): void;
    close(initiatedBy: InitiatedBy): void;
}