import React from 'react';
import moment from 'moment';
import useDuration from '../../hooks/useDuration';

interface Props {
    startedAt: string
}

const SessionDuration: React.FunctionComponent<Props> = ({ startedAt }) => {
    const t0 = React.useMemo(() => {
        return moment(startedAt);
    }, [startedAt]);
    const duration = useDuration(t0);
    const message = React.useMemo(() => {
        const absoluteDuration = duration.abs();
        const hours = absoluteDuration.hours();
        const minutes = absoluteDuration.minutes();
        const seconds = absoluteDuration.seconds();
        const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
        const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
        return `${hours}:${formattedMinutes}:${formattedSeconds}`;
    }, [duration]);
    return (
        <h3 className="text-center">
            {message}
        </h3>
    );
}

export default SessionDuration;
