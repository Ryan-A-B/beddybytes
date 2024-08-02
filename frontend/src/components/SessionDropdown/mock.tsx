import React from 'react';
import { List } from 'immutable';
import moment from 'moment';
import { Session } from '../../services/ParentStation/SessionListService/types';

const RFC3339 = "YYYY-MM-DDTHH:mm:ss.SSSZ";

interface Props {
    session_list: List<Session>;
    value: Session | null;
    onChange: (session: Session | null) => void;
}

const SessionsDropdown: React.FunctionComponent<Props> = ({ session_list, value, onChange }) => {
    const filtered_session_list = React.useMemo(() => {
        const disconnected_since_cutoff = moment().subtract(10, 'minutes');
        return session_list.filter((session) => {
            if (session.host_connection_state.state === 'connected') return true;
            return session.host_connection_state.since.isAfter(disconnected_since_cutoff)
        });
    }, [session_list]);
    return (
        <ul>
            {filtered_session_list.map((session) => (
                <li key={session.id}>
                    {session.id} {session.host_connection_state.state === 'connected' ? '🟢' : '🔴'}
                    <ul>
                        <li>Name: {session.name}</li>
                        <li>Host connection id: {session.host_connection_id}</li>
                        <li>Started at: {session.started_at.format(RFC3339)}</li>
                        <li>
                            Host connection state
                            <ul>
                                <li>State: {session.host_connection_state.state}</li>
                                <li>Since: {session.host_connection_state.since.format(RFC3339)}</li>
                                </ul>
                        </li>
                    </ul>
                </li>
            ))}
        </ul>
    )
}

export default SessionsDropdown;