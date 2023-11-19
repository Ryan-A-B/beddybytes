import React from 'react';
import { List } from 'immutable';
import moment from 'moment';
import { Session } from '../../services/SessionListService';

interface Props {
    session_list: List<Session>;
    value: Session | null;
    onChange: (session: Session | null) => void;
}

const SessionsDropdown: React.FunctionComponent<Props> = ({ session_list, value, onChange }) => {
    const filtered_session_list = React.useMemo(() => {
        const disconnected_since_cutoff = moment().subtract(5, 'minutes');
        return session_list.filter((session) => {
            if (session.host_connection_state.state === 'connected') return true;
            return session.host_connection_state.since.isAfter(disconnected_since_cutoff)
        });
    }, [session_list]);
    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        if (event.target.value === '') {
            onChange(null);
            return;
        }
        const session = filtered_session_list.find((session) => session.id === event.target.value)
        if (session === undefined) throw new Error(`Session ${event.target.value} not found`);
        onChange(session);
    }, [filtered_session_list, onChange])
    if (filtered_session_list.size === 0) return (
        <React.Fragment>
            No sessions found
        </React.Fragment>
    );
    return (
        <select value={value?.id ?? ''} onChange={handleChange} className="form-select">
            <option value="">Select a session</option>
            {filtered_session_list.map((session) => (
                <option value={session.id} key={session.id}>
                    {session.name} {session.host_connection_state.state === 'connected' ? '🟢' : '🔴'}
                </option>
            ))}
        </select>
    );
}

export default SessionsDropdown;
