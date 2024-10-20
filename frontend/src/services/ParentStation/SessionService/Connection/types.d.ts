type InitiatedByHost = 0;
type InitiatedByClient = 1;

type InitiatedBy = InitiatedByHost | InitiatedByClient;

interface Connection extends EventTarget {
    get_rtc_peer_connection_state(): RTCPeerConnectionState;
    reconnect(): void;
    close(initiatedBy: InitiatedBy): void;
}