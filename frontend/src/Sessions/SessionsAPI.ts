import { List } from 'immutable';
import moment from 'moment';
import { v4 as uuid } from 'uuid';
import authorization from '../authorization';
import { EndSessionInput, Session, Sessions, SessionsChangedEvent, StartSessionInput } from './Sessions';

const RFC3339 = 'YYYY-MM-DDTHH:mm:ssZ';

const sleep = (duration: number): Promise<void> => {
    return new Promise((resolve) => {
        setTimeout(resolve, duration);
    });
}

const getSessions = async (host: string): Promise<List<Session>> => {
    const accessToken = await authorization.getAccessToken()
    const response = await fetch(`https://${host}/sessions`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
        const payload = await response.text()
        console.error(`Failed to list sessions: ${payload}`)
        await sleep(5000)
        return getSessions(host)
    }
    if (response.status !== 200)
        throw new Error(`Failed to list sessions: ${response.status}`);
    const payload = await response.json();
    return List(payload.sessions);
}

const startSession = async (host: string, session: Session): Promise<void> => {
    const accessToken = await authorization.getAccessToken()
    const response = await fetch(`https://${host}/sessions/${session.id}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(session),
    })
    if (!response.ok) {
        const payload = await response.text()
        console.error(`Failed to start session: ${payload}`)
        await sleep(5000)
        return startSession(host, session)
    }
    if (response.status !== 200)
        throw new Error(`Failed to list sessions: ${response.status}`);
    return;
}

const endSession = async (host: string, sessionID: string): Promise<void> => {
    const accessToken = await authorization.getAccessToken()
    const response = await fetch(`https://${host}/sessions/${sessionID}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) {
        const payload = await response.text()
        console.error(`Failed to end session: ${payload}`)
        await sleep(5000)
        return endSession(host, sessionID)
    }
    if (response.status !== 200)
        throw new Error(`Failed to list sessions: ${response.status}`);
    return;
}

interface Events extends EventTarget {
}

const EventTypeSessionStarted = 'session.started';
const EventTypeSessionEnded = 'session.ended';


class SessionStartedEvent extends Event {
    session: Session;
    constructor(session: Session) {
        super(EventTypeSessionStarted);
        this.session = session;
    }

    static is(event: Event): event is SessionStartedEvent {
        return event.type === EventTypeSessionStarted;
    }
}

class SessionEndedEvent extends Event {
    session_id: string;
    constructor(session_id: string) {
        super(EventTypeSessionEnded);
        this.session_id = session_id;
    }

    static is(event: Event): event is SessionEndedEvent {
        return event.type === EventTypeSessionEnded;
    }
}

class SessionsAPI extends EventTarget implements Sessions {
    private host: string;
    private events: Events;
    private sessions: List<Session> = List();

    constructor(host: string, events: Events) {
        super();
        this.host = host;
        this.events = events;
        events.addEventListener(EventTypeSessionStarted, (event: Event) => {
            if (!SessionStartedEvent.is(event))
                throw new Error('invalid event');
            this.sessions = this.sessions.push(event.session);
            this.dispatchEvent(new SessionsChangedEvent(this.sessions));
        });
        events.addEventListener(EventTypeSessionEnded, (event: Event) => {
            if (!SessionEndedEvent.is(event))
                throw new Error('invalid event');
            this.sessions = this.sessions.filter((session) => session.id !== event.session_id);
            this.dispatchEvent(new SessionsChangedEvent(this.sessions));
        });
        getSessions(this.host).then((sessions) => {
            this.sessions = sessions;
            this.dispatchEvent(new SessionsChangedEvent(this.sessions));
        });
    }

    list = (): List<Session> => {
        return this.sessions;
    }

    start = async (input: StartSessionInput): Promise<Session> => {
        const now = moment();
        const session: Session = {
            id: uuid(),
            name: input.session_name,
            host_client_id: input.client_id,
            started_at: now.format(RFC3339),
        };
        await startSession(this.host, session)
        return session;
    }

    end = async (input: EndSessionInput): Promise<void> => {
        await endSession(this.host, input.session_id)
    }
}

export default SessionsAPI;
