import React from 'react';
import { Session } from '../Sessions/Sessions';

interface Props {
    session: Session | null;
    startSession: () => any;
    endSession: () => any;
    disabled: boolean;
}

const SessionToggle: React.FunctionComponent<Props> = ({ session, startSession, endSession, disabled }) => {
    if (session === null) {
        return (
            <button onClick={startSession} className="btn btn-primary" disabled={disabled}>
                Start
            </button>
        )
    }
    return (
        <button onClick={endSession} className="btn btn-danger">
            Stop
        </button>
    )
}

export default SessionToggle;
