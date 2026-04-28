import React from 'react';
import { SessionState } from '../../services/BabyStation/SessionService';

const id = 'session-toggle';

interface Props {
    baby_station_session_state: SessionState;
    startSession: () => any;
    endSession: () => any;
    disabled: boolean;
}

const SessionToggle: React.FunctionComponent<Props> = ({ baby_station_session_state, startSession, endSession, disabled }) => {
    switch (baby_station_session_state.name) {
        case 'no_session_running': return (
            <button id={id} onClick={startSession} className="btn btn-primary session-toggle" disabled={disabled}>
                Start
            </button>
        );
        case 'session_starting': return (
            <button id={id} className="btn btn-primary session-toggle" disabled>
                Starting...
            </button>
        );
        case 'session_running': return (
            <button id={id} onClick={endSession} className="btn btn-outline-danger session-toggle">
                Stop
            </button>
        );
        case 'session_ending': return (
            <button id={id} className="btn btn-outline-danger session-toggle" disabled>
                Stopping...
            </button>
        );
        default: {
            throw new Error(`Unknown session state: ${baby_station_session_state.name}`);
        }
    }
}

export default SessionToggle;
