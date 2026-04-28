interface ConnectedPayloadInput {
    connectionID: string;
    requestID: string;
    atMillis: number;
}

export const newConnectedPayload = (input: ConnectedPayloadInput): unknown => {
    return {
        type: "connected",
        connected: {
            connection_id: input.connectionID,
            request_id: input.requestID,
            at_millis: input.atMillis,
        },
    };
};

interface DisconnectedPayloadInput {
    connectionID: string;
    requestID: string;
    atMillis: number;
    reason: "clean" | "unexpected";
}

export const newDisconnectedPayload = (input: DisconnectedPayloadInput): unknown => {
    return {
        type: "disconnected",
        disconnected: {
            connection_id: input.connectionID,
            request_id: input.requestID,
            at_millis: input.atMillis,
            reason: input.reason,
        },
    };
};
