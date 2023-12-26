import { List } from 'immutable';
import { EventTypeSessionListChanged } from './ProjectedListService';
import SessionListService, { Session } from './types';

class MockSessionListService extends EventTarget implements SessionListService {
    private session_list: List<Session> = List();

    public get_session_list = (): List<Session> => {
        return this.session_list;
    }

    public set_session_list = (session_list: List<Session>) => {
        this.session_list = session_list;
        this.dispatchEvent(new Event(EventTypeSessionListChanged));
    }
}

export default MockSessionListService;
