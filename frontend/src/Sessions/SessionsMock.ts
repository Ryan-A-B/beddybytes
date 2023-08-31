import { List } from 'immutable';
import moment from 'moment';
import { v4 as uuid } from 'uuid';
import { EndSessionInput, Session, Sessions, SessionsChangedEvent, StartSessionInput } from './Sessions';

const RFC3339 = 'YYYY-MM-DDTHH:mm:ssZ';

class SessionsMock extends EventTarget implements Sessions {
    private sessions: List<Session> = List();

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
        this.sessions = this.sessions.push(session);
        this.dispatchEvent(new SessionsChangedEvent(this.sessions));
        return session;
    }

    end = async (input: EndSessionInput): Promise<void> => {
        this.sessions = this.sessions.filter(session => session.id !== input.session_id);
        this.dispatchEvent(new SessionsChangedEvent(this.sessions));
    }
}

export default SessionsMock;
