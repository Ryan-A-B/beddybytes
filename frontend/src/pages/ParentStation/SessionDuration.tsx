import React from 'react';
import moment from 'moment';
import useDuration from '../../hooks/useDuration';

interface Props {
    started_at: moment.Moment;
}

const SessionDuration: React.FunctionComponent<Props> = ({ started_at: startedAt }) => {
    const duration = useDuration(startedAt);
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
        <h3 className="session-duration text-center">
            {message}
        </h3>
    );
}

export default SessionDuration;
