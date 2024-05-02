import ParentStation from "../ParentStation";

import influx_logging_service from "./logging_service";
import signal_service from "./signal_service";
import event_service from "./event_service";

const parent_station = new ParentStation({
    logging_service: influx_logging_service,
    signal_service,
    event_service,
});

export default parent_station;