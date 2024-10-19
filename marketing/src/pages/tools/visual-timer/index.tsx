import React from "react";
import type { HeadFC, PageProps } from "gatsby"
import SEOHead from "../../../components/SEOHead";
import DefaultPageWrapper from "../../../components/DefaultPageWrapper";
import "./style.scss";

const green = "#198754";
const orange = "#fd7e14";
const red = "#dc3545";

interface VisualTimerSettings {
    duration_ms: number;
    initial_colour: string;
    final_colour: string;
    breakpoints: BreakPoint[];
}

interface BreakPoint {
    seconds_remaining: number;
    colour: string;
}

// TODO make configurable
const settings: VisualTimerSettings = {
    duration_ms: 25 * 60 * 1000,
    initial_colour: green,
    final_colour: red,
    breakpoints: [
        {
            seconds_remaining: 8 * 60,
            colour: orange
        }
    ]
};

interface RunningState {
    state: "running";
    start_time: number;
}

interface FinishedState {
    state: "finished";
}

interface NotStartedState {
    state: "not_started";
}

type VisualTimerState = RunningState | FinishedState | NotStartedState;

const InitialState: VisualTimerState = {
    state: "not_started"
};

interface StartAction {
    type: "start";
}

interface FinishAction {
    type: "finish";
}

interface ResetAction {
    type: "reset";
}

type VisualTimerAction = StartAction | FinishAction | ResetAction;

const apply = (state: VisualTimerState, action: VisualTimerAction): VisualTimerState => {
    switch (action.type) {
        case "start":
            return {
                state: "running",
                start_time: Date.now()
            };
        case "finish":
            return {
                state: "finished"
            };
        case "reset":
            return {
                state: "not_started"
            };
    }
}

const VisualTimerPage: React.FunctionComponent<PageProps> = () => {
    const div_ref = React.useRef<HTMLDivElement>(null);
    const [state, dispatch] = React.useReducer(apply, InitialState);
    const [current_time, set_current_time] = React.useState(Date.now());
    React.useEffect(() => {
        if (state.state !== "running") return;
        const interval = setInterval(() => {
            set_current_time(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, [state]);

    const dt = state.state === "running" ? current_time - state.start_time : 0;
    const duration_remaining = settings.duration_ms - dt;
    const seconds_remaining = Math.round(duration_remaining / 1000);
    const minutes_remaining = Math.floor(seconds_remaining / 60);

    React.useEffect(() => {
        if (state.state !== "running") return;
        if (navigator.wakeLock === undefined) return;
        const promise = navigator.wakeLock.request("screen");
        return () => {
            promise.then((wake_lock_sentinel) => wake_lock_sentinel.release());
        }
    }, [state]);

    React.useEffect(() => {
        if (duration_remaining > 0) return
        dispatch({ type: "finish" });
    }, [duration_remaining]);

    React.useLayoutEffect(() => {
        if (!div_ref.current) return;
        const div = div_ref.current;
        if (state.state === "not_started") {
            div.style.backgroundColor = settings.initial_colour;
            return;
        }
        if (state.state === "finished") {
            div.style.backgroundColor = settings.final_colour;
            return;
        }
        for (const breakpoint of settings.breakpoints) {
            if (seconds_remaining > breakpoint.seconds_remaining) return;
            div.style.backgroundColor = breakpoint.colour;
        }
    }, [div_ref, state, seconds_remaining]);

    const handle_start = () => {
        dispatch({ type: "start" });
        set_current_time(Date.now());
    }

    const handle_stop = () => {
        dispatch({ type: "reset" });
    }

    return (
        <DefaultPageWrapper without_call_to_action>
            <main className="py-5">
                <div className="visual-timer container">
                    <h1 className="text-center">
                        {state.state === "not_started" && (
                            <React.Fragment>
                                --:--
                            </React.Fragment>
                        )}
                        {state.state === "running" && (
                            <React.Fragment>
                                {minutes_remaining}:{(seconds_remaining % 60).toString().padStart(2, "0")}
                            </React.Fragment>
                        )}
                        {state.state === "finished" && (
                            <React.Fragment>
                                0:00
                            </React.Fragment>
                        )}
                    </h1>
                    <div className="text-center">
                        {state.state === "not_started" && (
                            <button onClick={handle_start} className="btn btn-primary">
                                Start
                            </button>
                        )}
                        {state.state !== "not_started" && (
                            <button onClick={handle_stop} className="btn btn-danger">
                                Reset
                            </button>
                        )}
                    </div>
                    <div ref={div_ref} className="visual-timer-indicator" />
                    <div className="alert alert-info">
                        <ul>
                            <li>Total duration is 25 minutes</li>
                            <li>Change to orange at 8 minutes</li>
                            <li>Change to red when finished</li>
                        </ul>
                    </div>
                </div>
            </main>
        </DefaultPageWrapper>
    );
}

export default VisualTimerPage;

export const Head: HeadFC = () => (
    <SEOHead
        title="Visual Timer"
        description="A visual timer to help your child understand the passage of time."
    />
);
