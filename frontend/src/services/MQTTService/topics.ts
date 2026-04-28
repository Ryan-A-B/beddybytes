export const clientStatusTopic = (accountID: string, clientID: string): string => {
    return `accounts/${accountID}/clients/${clientID}/status`;
};

export const clientStatusTopicFilter = (accountID: string): string => {
    return `accounts/${accountID}/clients/+/status`;
};
