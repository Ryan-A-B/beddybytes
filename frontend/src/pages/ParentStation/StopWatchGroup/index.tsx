import React from "react";
import { OrderedMap } from "immutable";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faStopwatch } from "@fortawesome/free-solid-svg-icons";
import CountUpTimer from "../../../services/ParentStation/CountUpTimer";
import StopWatch from "./StopWatch";

import "./style.scss";

const StopWatchGroup: React.FunctionComponent = () => {
    const [timerMap, setTimerMap] = React.useState<OrderedMap<string, CountUpTimer>>(OrderedMap());

    const addTimer = React.useCallback(() => {
        const timer = new CountUpTimer();
        timer.start();
        const id = crypto.randomUUID();
        const newTimerMap = timerMap.set(id, timer);
        setTimerMap(newTimerMap);
    }, [timerMap]);

    return (
        <div className="stopwatch-group">
            <button type="button" className="btn btn-outline-primary fs-4 mx-2 my-1" title="Add Timer" onClick={addTimer}>
                <FontAwesomeIcon icon={faStopwatch} className="mx-1" />
                <FontAwesomeIcon icon={faPlus} className="mx-1" />
            </button>
            {timerMap.map((timer, id) => (
                <StopWatch
                    key={id}
                    timer={timer}
                    remove={() => {
                        const newTimerMap = timerMap.delete(id);
                        setTimerMap(newTimerMap);
                    }}
                />
            )).valueSeq()}
        </div>
    )
}

export default StopWatchGroup;