import moment from 'moment';
import { v4 as uuid } from 'uuid';
import AuthorizationService from "./AuthorizationService";
import settings from "../settings";
import isClientError from '../utils/isClientError';
import sleep from '../utils/sleep';

export const EventTypeHostSessionStatusChanged = 'host_session_status_changed';

interface HostSessionStatusNoSessionRunning {
    status: 'no_session_running';
}

interface HostSessionStatusSessionStarting {
    status: 'session_starting';
    session_id: string;
}

interface HostSessionStatusSessionRunning {
    status: 'session_running';
    session_id: string;
    session_start: moment.Moment;
}

interface HostSessionStatusSessionEnding {
    status: 'session_ending';
    session_id: string;
}

export type HostSessionStatus =
    | HostSessionStatusNoSessionRunning
    | HostSessionStatusSessionStarting
    | HostSessionStatusSessionRunning
    | HostSessionStatusSessionEnding;


interface NewHostSessionServiceInput {
    authorization_service: AuthorizationService;
}

interface StartSessionInput {
    name: string;
    connection_id: string;
}

class HostSessionService extends EventTarget {
    private static RFC3339 = 'YYYY-MM-DDTHH:mm:ssZ';
    private authorization_service: AuthorizationService;
    private status: HostSessionStatus = { status: 'no_session_running' };

    constructor(input: NewHostSessionServiceInput) {
        super();
        this.authorization_service = input.authorization_service;
    }

    public get_status = (): HostSessionStatus => {
        return this.status;
    }

    private set_status = (status: HostSessionStatus): void => {
        this.status = status;
        this.dispatchEvent(new Event(EventTypeHostSessionStatusChanged));
    }

    public start_session = async (input: StartSessionInput): Promise<void> => {
        const access_token = await this.authorization_service.get_access_token();
        const session_id = uuid();
        this.set_status({
            status: 'session_starting',
            session_id: session_id,
        })
        const session_start = moment();
        const response = await fetch(`https://${settings.API.host}/sessions/${session_id}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
            body: JSON.stringify({
                id: session_id,
                name: input.name,
                host_connection_id: input.connection_id,
                started_at: session_start.format(HostSessionService.RFC3339),
            }),
        })
        if (!response.ok) {
            const payload = await response.text()
            if (isClientError(response.status))
                throw new Error(`Failed to start session: ${payload}`);
            console.error(`Failed to start session: ${payload}`)
            await sleep(5000)
            return this.start_session(input)
        }
        this.set_status({
            status: 'session_running',
            session_id,
            session_start,
        })
    }

    public end_session = async (): Promise<void> => {
        if (this.status.status !== 'session_running')
            throw new Error(`Cannot end session when not running`);
        const access_token = await this.authorization_service.get_access_token();
        const session_id = this.status.session_id;
        this.set_status({
            status: 'session_ending',
            session_id: session_id,
        })
        const response = await fetch(`https://${settings.API.host}/sessions/${session_id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        })
        if (!response.ok) {
            const payload = await response.text()
            if (isClientError(response.status))
                throw new Error(`Failed to end session: ${payload}`);
            console.error(`Failed to end session: ${payload}`)
            await sleep(5000)
            return this.end_session()
        }
        this.set_status({
            status: 'no_session_running',
        })
    }
}

export default HostSessionService;