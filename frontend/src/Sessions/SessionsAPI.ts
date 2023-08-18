import { List } from 'immutable';
import moment from 'moment';
import { v4 as uuid } from 'uuid';
import authorization from '../authorization';
import { EndSessionInput, Session, Sessions, StartSessionInput } from './Sessions';

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
    const payload = await response.json();
    return List(payload.sessions);
}

class SessionsAPI extends EventTarget implements Sessions {
    private host: string;
    private sessions: List<Session> = List();

    constructor(host: string) {
        super();
        this.host = host;

        // subscribe to events
        const query = new URLSearchParams({
            access_token: 'TODO',
        });
        const source = new EventSource(`https://${host}/events?${query}`);
        source.addEventListener('message', (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'session.started':
                    this.sessions = this.sessions.push(data.session);
                    this.dispatchEvent(new Event('sessions.changed'));
                    break;
                case 'session.ended':
                    this.sessions = this.sessions.filter(session => session.id !== data.session_id);
                    this.dispatchEvent(new Event('sessions.changed'));
                    break;
            }
        });
        source.onopen = () => {
            getSessions(this.host).then((sessions) => {
                this.sessions = sessions;
                this.dispatchEvent(new Event('sessions.changed'));
            });
        };
        source.onerror = (error) => {
            // TODO reconnect
            console.error(error);
            source.close();
        }
    }

    list = (): List<Session> => {
        return this.sessions;
    }

    start = (input: StartSessionInput): Session => {
        const now = moment();
        const session: Session = {
            id: uuid(),
            name: input.session_name,
            host_client_id: input.client_id,
            started_at: now.format(RFC3339),
        };
        fetch(`https://${this.host}/sessions`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer TODO`,
            },
            body: JSON.stringify(session),
        });
        return session;
    }

    end = (input: EndSessionInput): void => {
        fetch(`https://${this.host}/sessions/${input.session_id}`, {
            method: 'DELETE',
            headers: {
                Authorization: `Bearer TODO`,
            },
        });
    }
}

export default SessionsAPI;
