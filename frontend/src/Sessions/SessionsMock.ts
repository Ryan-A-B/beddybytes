import { List } from 'immutable';
import moment from 'moment';
import { v4 as uuid } from 'uuid';
import { EndSessionInput, EventTypeSessionsChanged, Session, SessionsReader, SessionsWriter, StartSessionInput } from './Sessions';

const RFC3339 = 'YYYY-MM-DDTHH:mm:ssZ';

class SessionsMock extends EventTarget implements SessionsReader, SessionsWriter {
    private sessionList: List<Session> = List();

    list = async (): Promise<List<Session>> => {
        return this.sessionList;
    }

    start = async (input: StartSessionInput): Promise<Session> => {
        const now = moment();
        const session: Session = {
            id: uuid(),
            name: input.session_name,
            host_connection_id: input.host_connection_id,
            started_at: now.format(RFC3339),
        };
        this.sessionList = this.sessionList.push(session);
        this.dispatchSessionsChangedEvent();
        return session;
    }

    end = async (input: EndSessionInput): Promise<void> => {
        this.sessionList = this.sessionList.filter((session) => session.id !== input.session_id);
        this.dispatchSessionsChangedEvent();
    }

    private dispatchSessionsChangedEvent = () => {
        this.dispatchEvent(new CustomEvent(EventTypeSessionsChanged, { detail: this.sessionList }));
    }
}

export default SessionsMock;
