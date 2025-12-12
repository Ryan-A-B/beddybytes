import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPause, faPlay, faRotateRight, faStopwatch } from "@fortawesome/free-solid-svg-icons";
import CountUpTimer, { EventTypeStateChanged } from "../../../services/ParentStation/CountUpTimer";

import "./style.scss";

const useTimerState = (timer: CountUpTimer) => {
    const [timerState, setTimerState] = React.useState<string>(timer.get_state());
    React.useEffect(() => {
        const updateTimerState = () => {
            setTimerState(timer.get_state());
        };
        timer.addEventListener(EventTypeStateChanged, updateTimerState);
        return () => {
            timer.removeEventListener(EventTypeStateChanged, updateTimerState);
        };
    }, [timer]);
    return timerState;
}

const useElapsedTime = (timer: CountUpTimer) => {
    const [elapsedTime, setElapsedTime] = React.useState<moment.Duration>(timer.get_elapsed_time());
    React.useEffect(() => {
        const updateElapsedTime = () => {
            setElapsedTime(timer.get_elapsed_time());
        };
        timer.addEventListener(EventTypeStateChanged, updateElapsedTime);
        const interval = setInterval(() => {
            updateElapsedTime();
        }, 1000);
        return () => {
            clearInterval(interval);
            timer.removeEventListener(EventTypeStateChanged, updateElapsedTime);
        };
    }, [timer]);
    return elapsedTime;
}

const StopWatch: React.FunctionComponent = () => {
    const timer = React.useMemo(() => new CountUpTimer(), []);
    const timer_state = useTimerState(timer);
    const elapsed_time = useElapsedTime(timer);
    const restart = React.useCallback(() => {
        timer.reset();
        timer.start();
    }, [timer]);
    const className = `stopwatch ${timer_state}`;
    return (
        <span className={className}>
            <FontAwesomeIcon icon={faStopwatch} className="mx-1" />

            <span className="fs-3 mx-1">
                {elapsed_time.hours().toString()}:{elapsed_time.minutes().toString().padStart(2, '0')}:{elapsed_time.seconds().toString().padStart(2, '0')}
            </span>
            {timer_state === 'Running' && (
                <button type="button" onClick={timer.pause} className="btn btn-link mx-1">
                    <FontAwesomeIcon icon={faPause} />
                </button>
            )}
            {timer_state !== 'Running' && (
                <button type="button" onClick={timer.start} className="btn btn-link mx-1">
                    <FontAwesomeIcon icon={faPlay} />
                </button>
            )}
            <button type="button" onClick={restart} className="btn btn-link mx-1">
                <FontAwesomeIcon icon={faRotateRight} />
            </button>
        </span>
    );
}

export default StopWatch;