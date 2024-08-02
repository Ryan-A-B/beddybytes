import { List } from 'immutable';
import settings from "../../../settings";
import isClientError from '../../../utils/isClientError';
import sleep from '../../../utils/sleep';
import LoggingService, { Severity } from '../../LoggingService';
import get_access_token_asap from "../../AuthorizationService/get_access_token_asap";
import EventSubscription from './EventSubscription';
import { EventTypeSessionListChanged, Session, SessionListService } from './types';
import eventstore from '../../../eventstore';
import SessionList from './SessionList';
import moment from 'moment';

interface NewSessionListServiceInput {
    logging_service: LoggingService;
    authorization_service: AuthorizationService;
}

class SessionListServiceImpl extends EventTarget implements SessionListService {
    private logging_service: LoggingService;
    private authorization_service: AuthorizationService;
    private session_list = new SessionList();

    constructor(input: NewSessionListServiceInput) {
        super();
        this.logging_service = input.logging_service;
        this.authorization_service = input.authorization_service;
        this.seed_session_list().then(this.subscribe);
    }

    public get_session_list = (): List<Session> => {
        return this.session_list.get_session_list();
    }

    private dispatch_session_list_changed_event = () => {
        this.dispatchEvent(new Event(EventTypeSessionListChanged));
    }

    private seed_session_list = async (): Promise<number> => {
        const endpoint = `https://${settings.API.host}/sessions`;
        const access_token = await get_access_token_asap(this.authorization_service);
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
        this.session_list.seed(sessions);
        this.dispatch_session_list_changed_event();
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
        const session_list_changed = this.session_list.apply(detail);
        if (!session_list_changed)
            return;
        this.dispatch_session_list_changed_event();
    }
}

export default SessionListServiceImpl;