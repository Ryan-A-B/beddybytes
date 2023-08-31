import React from 'react';
import useSessions from './useSessions';
import { Session, Sessions } from './Sessions';

interface Props {
    sessions: Sessions;
    value: Session | null;
    onChange: (session: Session | null) => void;
}

const SessionsDropdown: React.FunctionComponent<Props> = ({ sessions, value, onChange }) => {
    const sessionList = useSessions(sessions);
    const handleChange = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        if (event.target.value === '') {
            onChange(null);
            return;
        }
        const session = sessionList.find((session) => session.id === event.target.value)
        if (session === undefined) throw new Error(`Session ${event.target.value} not found`);
        onChange(session);
    }, [sessionList, onChange])
    if (sessionList.size === 0) return (
        <div>
            No sessions found
        </div>
    );
    return (
        <select value={value?.id ?? ''} onChange={handleChange} className="form-select">
            <option value="">Select a session</option>
            {sessionList.map((session) => (
                <option value={session.id} key={session.id}>
                    {session.name}
                </option>
            ))}
        </select>
    );
}

export default SessionsDropdown;
