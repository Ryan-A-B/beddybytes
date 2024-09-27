import settings from "../../../settings";
import isClientError from '../../../utils/isClientError';
import sleep from '../../../utils/sleep';
import Service from '../../Service';
import LoggingService, { Severity } from '../../LoggingService';
import eventstore from '../../../eventstore';
import { AuthorizationService } from '../../AuthorizationService/types';
import wait_for_token_fetched from '../../AuthorizationService/wait_for_token_fetched';
import EventSubscription from './EventSubscription';
import { SessionListService, SessionListServiceState } from './types';
import SessionListProjection from './SessionListProjection';
import moment from 'moment';

interface NewSessionListServiceInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

// TODO implement stop method which closes the EventSubscription
// TODO use a ref counter to avoid multiple subscriptions
// TODO store the state and cursor in the local storage
// TODO only seed the session list if local storage is out of date by more than n days
class SessionListServiceHTTP extends Service<SessionListServiceState> implements SessionListService {
    private logging_service: LoggingService;
    private authorization_service: AuthorizationService;
    private projection: SessionListProjection;
    private started = false;

    constructor(input: NewSessionListServiceInput) {
        const projection = new SessionListProjection();
        super(projection.get_session_list());
        this.logging_service = input.logging_service;
        this.authorization_service = input.authorization_service;
        this.projection = projection;
    }

    public start = async () => {
        if (this.started) return;
        this.started = true;
        await wait_for_token_fetched(this.authorization_service);
        const cursor = await this.seed_session_list()
        return this.subscribe(cursor);
    }

    private seed_session_list = async (): Promise<number> => {
        const endpoint = `https://${settings.API.host}/sessions`;
        const access_token = await this.authorization_service.get_access_token();
        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });
        if (!response.ok) {
            const payload = await response.text();
            if (isClientError(response.status))
                throw new Error(`Failed to list sessions: ${payload}`);
            this.logging_service.log({
                severity: Severity.Error,
                message: `Failed to list sessions: ${payload}`,
            });
            await sleep(5000);
            this.seed_session_list();
        }
        const output = await response.json();
        const sessions = output.sessions.map((session: any) => ({
            ...session,
            started_at: moment(session.started_at, eventstore.MomentFormatRFC3339),
            host_connection_state: {
                ...session.host_connection_state,
                since: moment(session.host_connection_state.since, eventstore.MomentFormatUnixTimestamp),
            }
        }));
        this.projection.seed(sessions);
        this.set_state(this.projection.get_session_list());
        return output.cursor;
    }

    private subscribe = async (cursor: number) => {
        const event_subscription = new EventSubscription({
            logging_service: this.logging_service,
            authorization_service: this.authorization_service,
            from_cursor: cursor,
        });
        event_subscription.addEventListener('event', this.handle_event);
    }

    private handle_event = (event: Event) => {
        const isCustomEvent = event instanceof CustomEvent;
        if (!isCustomEvent)
            return;
        const detail = event.detail as eventstore.Event;
        const session_list_changed = this.projection.apply(detail);
        if (!session_list_changed)
            return;
        this.set_state(this.projection.get_session_list());
    }
}

export default SessionListServiceHTTP;