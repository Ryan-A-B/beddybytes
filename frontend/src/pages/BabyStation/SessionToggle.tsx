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
        case 'Ready': return (
            <button id={id} onClick={startSession} className="btn btn-primary w-100" disabled={disabled}>
                Start
            </button>
        );
        case 'SessionStarting': return (
            <button id={id} className="btn btn-primary w-100" disabled>
                Starting...
            </button>
        );
        case 'SessionRunning': return (
            <button id={id} onClick={endSession} className="btn btn-danger w-100">
                Stop
            </button>
        );
        default: {
            const _exhaustiveCheck: never = baby_station_session_state;
            throw new Error(`Unknown session state: ${_exhaustiveCheck}`);
        }
    }
}

export default SessionToggle;
