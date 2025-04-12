import React from "react";
import SessionService from "../../services/ParentStation/SessionService";
import BabyStationListService from "../../services/ParentStation/BabyStationListService";
import useServiceState from "../../hooks/useServiceState";
import { Session } from "../../services/ParentStation/types";

interface Props {
    session_service: SessionService;
    baby_station_list_service: BabyStationListService;
}

const BabyStationDropdown: React.FunctionComponent<Props> = ({ session_service, baby_station_list_service }) => {
    const session_state = useServiceState(session_service);
    const baby_station_list_state = useServiceState(baby_station_list_service);

    const active_session: Session | null = React.useMemo(() => session_state.get_active_session(), [session_state]);

    const baby_stations = React.useMemo(() => baby_station_list_state.get_baby_station_list(), [baby_station_list_state]);

    const handle_change = React.useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
        session_service.leave_session();
        const session_id = event.target.value;
        const baby_station = baby_stations.find((session) => session.session.id === session_id);
        if (baby_station === undefined) return;
        session_service.join_session(baby_station.session);
    }, [session_service, baby_stations]);

    if (baby_stations.size === 0) return (
        <div id="alert-no-baby-stations" className="alert alert-info" role="alert">
            No baby stations found
        </div>
    );

    const active_session_id = active_session?.id ?? "";
    return (
        <select id="baby-station-dropdown" value={active_session_id} onChange={handle_change} className="form-select">
            {baby_stations.map((baby_station) => (
                <option value={baby_station.session.id} key={baby_station.session.id}>
                    {baby_station.session.name}
                </option>
            ))}
        </select>
    );
}

export default BabyStationDropdown;