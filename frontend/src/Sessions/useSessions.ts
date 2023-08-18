import React from 'react';
import { List } from 'immutable';
import { EventTypeSessionsChanged, Session, Sessions, SessionsChangedEvent } from './Sessions';

const isSessionsChangedEvent = (event: Event): event is SessionsChangedEvent => {
    return event.type === EventTypeSessionsChanged;
}

const useSessions = (sessions: Sessions) => {
    const [snapshot, setSnapshot] = React.useState<List<Session>>(sessions.list);
    React.useEffect(() => {
        const handle = (event: Event) => {
            if (!isSessionsChangedEvent(event))
                throw new Error('Unexpected event type');
            setSnapshot(event.sessions);
        }
        sessions.addEventListener(EventTypeSessionsChanged, handle)
        return () => {
            sessions.removeEventListener(EventTypeSessionsChanged, handle)
        }
    }, [sessions, setSnapshot]);
    return snapshot;
}

export default useSessions;
