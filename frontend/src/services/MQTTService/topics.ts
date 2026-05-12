export const clientStatusTopic = (accountID: string, clientID: string): string => {
    return `accounts/${accountID}/clients/${clientID}/status`;
};

export interface ClientStatusTopicParts {
    account_id: string;
    client_id: string;
}

export const parse_client_status_topic = (topic: string): Optional<ClientStatusTopicParts> => {
    const match = topic.match(/^accounts\/([^/]+)\/clients\/([^/]+)\/status$/);
    if (match === null) return null;
    return {
        account_id: match[1],
        client_id: match[2],
    };
};
