import React from "react";
import parent_station from "../services/instances/parent_station";
import useServiceState from "./useServiceState";

const useSessionList = () => {
    const session_list_service = parent_station.session_list_service;
    React.useEffect(() => {
        session_list_service.start();
    })
    return useServiceState(session_list_service);
}

export default useSessionList;