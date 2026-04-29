export const clientStatusTopic = (accountID: string, clientID: string): string => {
    return `accounts/${accountID}/clients/${clientID}/status`;
};

export const clientStatusTopicFilter = (accountID: string): string => {
    return `accounts/${accountID}/clients/+/status`;
};

export const client_webrtc_inbox_topic = (account_id: string, client_id: string): string => {
    return `accounts/${account_id}/clients/${client_id}/webrtc_inbox`;
};

export const babyStationsTopic = (accountID: string): string => {
    return `accounts/${accountID}/baby_stations`;
};

export const parentStationsTopic = (accountID: string): string => {
    return `accounts/${accountID}/parent_stations`;
};

export const clientControlInboxTopic = (accountID: string, clientID: string): string => {
    return `accounts/${accountID}/clients/${clientID}/control_inbox`;
};
