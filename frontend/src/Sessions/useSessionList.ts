import React from 'react';
import { List } from 'immutable';
import { EventTypeSessionsChanged, Session, SessionsReader } from './Sessions';

const InitialSessionList = List<Session>();

let previousSessions:SessionsReader|null = null;

const isCustomEvent = (event: Event): event is CustomEvent => {
    return event instanceof CustomEvent;
}

const useSessionList = (sessions: SessionsReader) => {
    const [sessionList, setSessionList] = React.useState<List<Session>>(InitialSessionList);
    React.useEffect(() => {
        previousSessions = sessions;
        const handleSessionListChange = (event: Event) => {
            if (!isCustomEvent(event)) throw new Error('invalid event');
            const sessionList = event.detail as List<Session>;
            setSessionList(sessionList)
        };
        sessions.addEventListener(EventTypeSessionsChanged, handleSessionListChange);
        sessions.list().then((sessionList) => {
            setSessionList(sessionList)
        });
        return () => {
            sessions.removeEventListener(EventTypeSessionsChanged, handleSessionListChange);
        };
    }, [sessions, setSessionList]);
    return sessionList;
}

export default useSessionList;
