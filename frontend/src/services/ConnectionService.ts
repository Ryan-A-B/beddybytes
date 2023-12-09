import AuthorizationService from "./AuthorizationService";
import LoggingService from "./LoggingService";
import AccountService, { EventTypeAccountStatusChanged } from "./AccountService";
import WebSocketConnection from "../Connection/WebSocketConnection";
import Connection, { EventTypeConnectionLost } from "../Connection/Connection";
import { Severity } from "./LoggingService/models";

export const EventTypeConnectionStatusChanged = 'connection_status_changed';

interface ConnectionStatusNotConnected {
    status: 'not_connected';
}

interface ConnectionStatusConnected {
    status: 'connected';
    connection: Connection;
}

interface ConnectionStatusDisconnected {
    status: 'disconnected';
    connection: Connection;
}

export type ConnectionStatus = ConnectionStatusNotConnected | ConnectionStatusConnected | ConnectionStatusDisconnected;

interface NewConnectionServiceInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
    account_service: AccountService;
}

class ConnectionService extends EventTarget {
    private logging_service: LoggingService;
    private authorization_service: AuthorizationService;
    private account_service: AccountService;
    private status: ConnectionStatus;

    constructor(input: NewConnectionServiceInput) {
        super();
        this.logging_service = input.logging_service;
        this.authorization_service = input.authorization_service;
        this.account_service = input.account_service;
        this.status = { status: 'not_connected' };

        this.account_service.addEventListener(EventTypeAccountStatusChanged, this.handle_account_status_changed);

        const account_status = this.account_service.get_status();
        if (account_status.status !== 'have_account')
            return;
        this.connect();
    }

    public get_status = (): ConnectionStatus => {
        return this.status;
    }

    private set_status = (status: ConnectionStatus) => {
        this.logging_service.log({
            severity: Severity.Debug,
            message: `Connection status changed from ${this.status.status} to ${status.status}`,
        });
        this.status = status;
        this.dispatchEvent(new Event(EventTypeConnectionStatusChanged));
    }

    private connect = async () => {
        if (this.status.status !== 'not_connected')
            throw new Error(`Expected status to be not_connected, but was ${this.status.status}`);
        const connection = await WebSocketConnection.create({
            authorization_service: this.authorization_service,
            logging_service: this.logging_service,
        })
        this.set_status({
            status: 'connected',
            connection,
        })
        connection.addEventListener(EventTypeConnectionLost, this.handle_client_disconnected);
    }

    private disconnect = async () => {
        // TODO
        this.set_status({ status: 'not_connected' });
    }

    private handle_account_status_changed = async () => {
        const account_status = this.account_service.get_status();
        if (account_status.status !== 'have_account')
            return this.disconnect();
        this.connect();
    }

    private handle_client_disconnected = async () => {
        if (this.status.status !== 'connected')
            throw new Error(`Expected status to be connected, but was ${this.status.status}`);
        this.set_status({
            status: 'disconnected',
            connection: this.status.connection,
        });
    }
}

export default ConnectionService;
