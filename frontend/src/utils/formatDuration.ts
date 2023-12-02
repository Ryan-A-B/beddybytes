import moment from 'moment';

const format_duration = (duration: moment.Duration): string => {
    const absoluteDuration = duration.abs();
    const hours = absoluteDuration.hours();
    const minutes = absoluteDuration.minutes();
    const seconds = absoluteDuration.seconds();
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    const formattedSeconds = seconds < 10 ? `0${seconds}` : seconds;
    return `${hours}:${formattedMinutes}:${formattedSeconds}`;
}

export default format_duration;