import React from 'react';
import { HostSessionStatus } from '../../services/HostSessionService';

const id = 'session-toggle';

interface Props {
    host_session_status: HostSessionStatus;
    startSession: () => any;
    endSession: () => any;
    disabled: boolean;
}

const SessionToggle: React.FunctionComponent<Props> = ({ host_session_status, startSession, endSession, disabled }) => {
    switch (host_session_status.status) {
        case 'no_session_running': return (
            <button id={id} onClick={startSession} className="btn btn-primary w-100" disabled={disabled}>
                Start
            </button>
        );
        case 'session_starting': return (
            <button id={id} className="btn btn-primary w-100" disabled>
                Starting...
            </button>
        );
        case 'session_running': return (
            <button id={id} onClick={endSession} className="btn btn-danger w-100">
                Stop
            </button>
        );
        case 'session_ending': return (
            <button id={id} className="btn btn-danger w-100" disabled>
                Stopping...
            </button>
        );
    }
}

export default SessionToggle;
