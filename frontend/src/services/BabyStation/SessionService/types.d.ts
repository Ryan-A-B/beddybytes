interface BabyStationSessionStatusNoSessionRunning {
    status: 'no_session_running';
}

interface BabyStationSessionStatusSessionStarting {
    status: 'session_starting';
    session_id: string;
}

interface BabyStationSessionStatusSessionRunning {
    status: 'session_running';
    session_id: string;
}

interface BabyStationSessionStatusSessionEnding {
    status: 'session_ending';
    session_id: string;
}

type HostSessionStatus =
    | BabyStationSessionStatusNoSessionRunning
    | BabyStationSessionStatusSessionStarting
    | BabyStationSessionStatusSessionRunning
    | BabyStationSessionStatusSessionEnding;

interface BabyStationSessionService extends EventTarget {
    get_status(): HostSessionStatus;
    start_session(input: StartSessionInput): Promise<void>;
    end_session(): Promise<void>;
}