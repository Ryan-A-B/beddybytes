import React from 'react';
import moment from 'moment';

const useDuration = (t0: moment.Moment): moment.Duration => {
    const [duration, setDuration] = React.useState(() => {
        return moment.duration(t0.diff(moment()));
    });
    React.useEffect(() => {
        const interval = setInterval(() => {
            setDuration(moment.duration(t0.diff(moment())));
        }, 1000);
        return () => {
            clearInterval(interval);
        }
    }, [t0]);
    return duration;
};

export default useDuration;
