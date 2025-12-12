import React from "react";
import parent_station from "../../services/instances/parent_station";
import useServiceState from "../../hooks/useServiceState";
import ConnectionStateAlert from "../../components/ConnectionStateAlert";
import AudioVisualiserComponent from "../../components/AudioVisualiser";
import BabyStationDropdown from "./BabyStationDropdown";
import SessionDuration from "./SessionDuration";
import Video from "./Video";
import StopWatch from "./StopWatch";

import "./style.scss";

const useParentStation = () => {
    React.useEffect(() => {
        parent_station.start();
        return () => {
            parent_station.stop();
        }
    }, []);
    return parent_station;
}

const ParentStation: React.FunctionComponent = () => {
    useParentStation();
    const session_service = parent_station.session_service;
    const session_state = useServiceState(session_service);
    const media_stream_track_state = useServiceState(parent_station.media_stream_track_monitor);

    const session = React.useMemo(() => session_state.get_active_session(), [session_state]);

    // TODO detect audio-only and empty streams

    return (
        <main className={`container wrapper-content parent-station ${media_stream_track_state}`}>
            <BabyStationDropdown session_service={session_service} baby_station_list_service={parent_station.baby_station_list_service} />
            <ConnectionStateAlert />
            <StopWatch />
            {session !== null && <SessionDuration started_at={session.started_at} />}
            {media_stream_track_state === "audio-only" && (
                <React.Fragment>
                    <p id="audio-only-message">Audio only</p>
                    <AudioVisualiserComponent
                        media_stream={parent_station.media_stream}
                        width={640}
                        height={360}
                        className="audio-visualiser"
                    />
                </React.Fragment>
            )}
            <Video />
        </main>
    );
};

export default ParentStation;
