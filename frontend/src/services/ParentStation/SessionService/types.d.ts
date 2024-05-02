interface ParentStationSessionStateNotJoined {
    state: 'not_joined';
}

interface ParentStationSessionStateJoining {
    state: 'joining';
    session: Session;
}

interface ParentStationSessionStateJoined {
    state: 'joined';
    session: Session;
    client_connection: Connection;
}

interface ParentStationSessionStateLeft {
    state: 'left';
}

interface ParentStationSessionStateSessionEnded {
    state: 'session_ended';
}

type ParentStationSessionState =
    ParentStationSessionStateNotJoined |
    ParentStationSessionStateJoining |
    ParentStationSessionStateJoined |
    ParentStationSessionStateLeft |
    ParentStationSessionStateSessionEnded;

interface ParentStationSessionService extends EventTarget {
    get_state(): ParentStationSessionState;
    join_session(session: Session): void;
    leave_session(): void;
}
