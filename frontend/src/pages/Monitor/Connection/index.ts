import { Session } from "../../../services/SessionListService";

type OnTrack = (event: RTCTrackEvent) => void;
type OnConnectionStateChange = (event: Event) => void;

export interface Connection {
    ontrack?: OnTrack;
    onconnectionstatechange?: OnConnectionStateChange;
    close: (initiatedByPeer: boolean) => void;
}

export interface ConnectionFactory {
    create: (session: Session) => Connection;
}
