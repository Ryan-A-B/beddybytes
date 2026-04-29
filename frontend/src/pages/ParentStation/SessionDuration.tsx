import React from 'react';
import moment from 'moment';
import useDuration from '../../hooks/useDuration';

interface Props {
    started_at: number;
}

const SessionDuration: React.FunctionComponent<Props> = ({ started_at: startedAt }) => {
    const started_at = React.useMemo(() => moment(startedAt), [startedAt]);
    const duration = useDuration(started_at);
    const message = React.useMemo(() => {
        const absoluteDuration = duration.abs();
        const hours = Math.floor(absoluteDuration.asHours());
        const minutes = absoluteDuration.minutes();
        const seconds = absoluteDuration.seconds();
        const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
        const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
        return `${hours}:${formattedMinutes}:${formattedSeconds}`;
    }, [duration]);
    return (
        <span className="session-duration text-center fs-3">
            {message}
        </span>
    );
}

export default SessionDuration;
