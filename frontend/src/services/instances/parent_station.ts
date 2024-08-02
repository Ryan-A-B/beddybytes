import ParentStation from "../ParentStation";

import influx_logging_service from "./logging_service";
import authorization_service from "./authorization_service";
import signal_service from "./signal_service";

const parent_station = new ParentStation({
    logging_service: influx_logging_service,
    authorization_service: authorization_service,
    signal_service,
});

export default parent_station;