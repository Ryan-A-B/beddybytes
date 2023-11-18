import React from 'react';
import { List } from 'immutable';
import { Session } from '../services/SessionListService';

interface Props {
    session_list: List<Session>;
    value: Session | null;
    onChange: (session: Session | null) => void;
}

const SessionsDropdown: React.FunctionComponent<Props> = ({ session_list, value, onChange }) => {
    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        if (event.target.value === '') {
            onChange(null);
            return;
        }
        const session = session_list.find((session) => session.id === event.target.value)
        if (session === undefined) throw new Error(`Session ${event.target.value} not found`);
        onChange(session);
    }, [session_list, onChange])
    if (session_list.size === 0) return (
        <React.Fragment>
            No sessions found
        </React.Fragment>
    );
    return (
        <select value={value?.id ?? ''} onChange={handleChange} className="form-select">
            <option value="">Select a session</option>
            {session_list.map((session) => (
                <option value={session.id} key={session.id}>
                    {session.name} {session.host_connection_state.state === 'connected' ? '🟢' : '🔴'}
                </option>
            ))}
        </select>
    );
}

export default SessionsDropdown;
