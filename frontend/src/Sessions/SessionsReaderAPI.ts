import { List } from 'immutable';
import settings from '../settings';
import authorization from '../authorization';
import { Session, SessionsReader, SessionStartedEventDetail as SessionStartedEventDetail, SessionEndedEventDetail, EventTypeSessionsChanged } from './Sessions';

const sleep = (duration: number): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(resolve, duration);
    });
}

const isClientError = (code: number): boolean => (code >= 400 && code < 500);

const getSessions = async (): Promise<List<Session>> => {
    const accessToken = await authorization.getAccessToken()
    const response = await fetch(`https://${settings.API.host}/sessions`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (response.ok) {
        const payload = await response.json();
        return List(payload);
    }
    const payload = await response.text()
    if (isClientError(response.status))
        throw new Error(`Failed to list sessions: ${payload}`);
    console.error(`Failed to list sessions: ${payload}`)
    await sleep(5000)
    return getSessions()
}

const EventTypeSessionStarted = 'session.started';
const EventTypeSessionEnded = 'session.ended';

const isCustomEvent = (event: Event): event is CustomEvent => {
    return event instanceof CustomEvent;
}

class SessionsReaderAPI extends EventTarget implements SessionsReader {
    private sessionList: List<Session> = List();

    constructor(events: EventTarget) {
        super();
        events.addEventListener(EventTypeSessionStarted, (event: Event) => {
            if (!isCustomEvent(event)) throw new Error('invalid event');
            const detail = event.detail as SessionStartedEventDetail;
            this.sessionList = this.sessionList.push(detail);
            this.dispatchSessionsChangedEvent();
        });
        events.addEventListener(EventTypeSessionEnded, (event: Event) => {
            if (!isCustomEvent(event)) throw new Error('invalid event');
            const detail = event.detail as SessionEndedEventDetail;
            this.sessionList = this.sessionList.filter((session) => session.id !== detail.id);
            this.dispatchSessionsChangedEvent();
        });
    }

    list = async (): Promise<List<Session>> => {
        const sessionList = await getSessions();
        this.sessionList = sessionList;
        this.dispatchSessionsChangedEvent();
        return sessionList;
    }

    private dispatchSessionsChangedEvent = () => {
        this.dispatchEvent(new CustomEvent(EventTypeSessionsChanged, { detail: this.sessionList }));
    }
}

export default SessionsReaderAPI;
