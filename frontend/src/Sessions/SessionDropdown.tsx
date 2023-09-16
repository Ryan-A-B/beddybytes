import React from 'react';
import useSessionList from './useSessionList';
import { Session, SessionsReader } from './Sessions';

interface Props {
    sessions: SessionsReader;
    value: Session | null;
    onChange: (session: Session | null) => void;
}

const SessionsDropdown: React.FunctionComponent<Props> = ({ sessions, value, onChange }) => {
    const sessionList = useSessionList(sessions);
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
        <React.Fragment>
            No sessions found
        </React.Fragment>
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
