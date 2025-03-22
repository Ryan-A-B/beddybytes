import moment from 'moment';
import { v4 as uuid } from 'uuid';
import Service, { SetStateFunction } from '../../Service';
import LoggingService, { Severity } from '../../LoggingService';
import settings from "../../../settings";
import isClientError from '../../../utils/isClientError';
import sleep from '../../../utils/sleep';

const RFC3339 = 'YYYY-MM-DDTHH:mm:ssZ';

export interface SessionState {
    name: string;
    start_session: (set_state: SetStateFunction<SessionState>, input: StartSessionInput) => Promise<void>;
    end_session: (set_state: SetStateFunction<SessionState>) => Promise<void>;
}

interface NewNoSessionRunningInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

class NoSessionRunning implements SessionState {
    public readonly name = 'no_session_running';
    private authorization_service: AuthorizationService;
    private logging_service: LoggingService;

    constructor(input: NewNoSessionRunningInput) {
        this.authorization_service = input.authorization_service;
        this.logging_service = input.logging_service;
    }

    start_session = async (set_state: SetStateFunction<SessionState>, input: StartSessionInput): Promise<void> => {
        set_state(new SessionStarting());

        const session_id = uuid();
        const access_token = await this.authorization_service.get_access_token();
        const response = await fetch(`https://${settings.API.host}/sessions/${session_id}`, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
            body: JSON.stringify({
                id: session_id,
                name: input.name,
                host_connection_id: input.connection_id,
                started_at: moment().format(RFC3339),
            }),
        });
        if (!response.ok) {
            const payload = await response.text();
            if (isClientError(response.status))
                throw new Error(`Failed to start session: ${payload}`);
            this.logging_service.log({
                severity: Severity.Error,
                message: `Failed to start session: ${payload}`,
            });
            await sleep(5000);
            return this.start_session(set_state, input);
        }
        set_state(new SessionRunning({
            logging_service: this.logging_service,
            authorization_service: this.authorization_service,
            session_id: session_id,
        }));
    }

    end_session = async (set_state: SetStateFunction<SessionState>) => {
        throw new Error('Cannot end session when not running');
    }
}

class SessionStarting implements SessionState {
    public readonly name = 'session_starting';

    start_session = async (set_state: SetStateFunction<SessionState>, input: StartSessionInput) => {
        throw new Error('Cannot start session when already starting');
    }

    end_session = async (set_state: SetStateFunction<SessionState>) => {
        throw new Error('Cannot end session when starting');
    }
}

interface NewSessionRunningInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
    session_id: string;
}

class SessionRunning implements SessionState {
    public readonly name = 'session_running';
    public readonly session_id: string;
    private authorization_service: AuthorizationService;
    private logging_service: LoggingService;

    constructor(input: NewSessionRunningInput) {
        this.session_id = input.session_id;
        this.authorization_service = input.authorization_service;
        this.logging_service = input.logging_service;
    }

    start_session = async (set_state: SetStateFunction<SessionState>) => {
        throw new Error('Cannot start session when already running');
    }

    end_session = async (set_state: SetStateFunction<SessionState>): Promise<void> => {
        set_state(new SessionEnding());
        const access_token = await this.authorization_service.get_access_token();
        const response = await fetch(`https://${settings.API.host}/sessions/${this.session_id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });
        if (!response.ok) {
            const payload = await response.text();
            if (isClientError(response.status))
                throw new Error(`Failed to end session: ${payload}`);
            this.logging_service.log({
                severity: Severity.Error,
                message: `Failed to end session: ${payload}`,
            });
            await sleep(5000);
            return this.end_session(set_state);
        }
        set_state(new NoSessionRunning({
            logging_service: this.logging_service,
            authorization_service: this.authorization_service,
        }));
    }
}

class SessionEnding implements SessionState {
    public readonly name = 'session_ending';

    start_session = async (set_state: SetStateFunction<SessionState>) => {
        throw new Error('Cannot start session when ending');
    }

    end_session = async (set_state: SetStateFunction<SessionState>) => {
        throw new Error('Cannot end session when ending');
    }
}

interface NewHostSessionServiceInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

interface StartSessionInput {
    name: string;
    connection_id: string;
}

class SessionService extends Service<SessionState> {
    protected readonly name = 'BabyStationSessionService';

    constructor(input: NewHostSessionServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: new NoSessionRunning({
                logging_service: input.logging_service,
                authorization_service: input.authorization_service,
            }),
        });
    }

    protected to_string(state: SessionState): string {
        return state.name;
    }

    public start_session = async (input: StartSessionInput): Promise<void> => {
        const state = this.get_state();
        state.start_session(this.set_state, input)
    }

    public end_session = async (): Promise<void> => {
        const state = this.get_state();
        state.end_session(this.set_state);
    }
}

export default SessionService;