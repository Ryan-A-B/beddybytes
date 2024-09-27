import { List } from 'immutable';
import Service from '../../Service';
import { Session, SessionListService, SessionListServiceState } from './types';

class MockSessionListService extends Service<SessionListServiceState> implements SessionListService {
    constructor() {
        super(List());
    }

    public start = () => {
        return this.get_state();
    }

    public set_session_list = (session_list: List<Session>) => {
        this.set_state(session_list);
    }
}

export default MockSessionListService;
