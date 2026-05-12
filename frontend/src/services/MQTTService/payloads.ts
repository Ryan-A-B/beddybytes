export interface ConnectedPayload {
    type: "connected";
    connection_id: string;
    request_id: string;
    at_millis: number;
}

export interface DisconnectedPayload {
    type: "disconnected";
    connection_id: string;
    request_id: string;
    at_millis: number;
    disconnected: {
        reason: "clean" | "unexpected";
    }
}

export interface SessionAnnouncement {
    client_id: string;
    connection_id: string;
    session_id: string;
    name: string;
    started_at_millis: number;
}

export const newBabyStationAnnouncementPayload = (announcement: SessionAnnouncement): unknown => {
    return {
        type: "announcement",
        at_millis: announcement.started_at_millis,
        announcement,
    };
};

export interface ParentStationAnnouncement {
    client_id: string;
    connection_id: string;
}

export const newParentStationAnnouncementPayload = (announcement: ParentStationAnnouncement, atMillis: number): unknown => {
    return {
        type: "announcement",
        at_millis: atMillis,
        announcement,
    };
};

export const newBabyStationControlAnnouncementPayload = (announcement: SessionAnnouncement, atMillis: number): unknown => {
    return {
        type: "baby_station_announcement",
        at_millis: atMillis,
        baby_station_announcement: announcement,
    };
};

export interface WebRTCDescriptionPayload {
    from_client_id: string;
    type: "description";
    description: RTCSessionDescriptionInit;
}

export interface WebRTCCandidatePayload {
    from_client_id: string;
    type: "candidate";
    candidate: RTCIceCandidateInit;
}

export type WebRTCInboxPayload = WebRTCDescriptionPayload | WebRTCCandidatePayload;

interface WebRTCSignalData {
    description?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
}

export const new_webrtc_inbox_payload = (from_client_id: string, data: WebRTCSignalData): WebRTCInboxPayload => {
    if (data.description !== undefined) {
        return {
            from_client_id,
            type: "description",
            description: data.description,
        };
    }
    if (data.candidate !== undefined) {
        return {
            from_client_id,
            type: "candidate",
            candidate: data.candidate,
        };
    }
    throw new Error("missing WebRTC signal data");
};
