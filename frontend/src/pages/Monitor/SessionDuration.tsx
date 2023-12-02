import React from 'react';
import moment from 'moment';
import useDuration from '../../hooks/useDuration';
import format_duration from '../../utils/formatDuration';

interface Props {
    startedAt: moment.Moment;
}

const SessionDuration: React.FunctionComponent<Props> = ({ startedAt }) => {
    const duration = useDuration(startedAt);
    const message = React.useMemo(
        () => format_duration(duration),
        [duration]
    );
    return (
        <h3 className="text-center">
            {message}
        </h3>
    );
}

export default SessionDuration;
