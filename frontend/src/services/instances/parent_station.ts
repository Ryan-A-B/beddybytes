import ParentStation from "../ParentStation";

import logging_service from "./logging_service";
import authorization_service from "./authorization_service";
import signal_service from "./signal_service";
import wake_lock_service from "./wake_lock_service";

const parent_station = new ParentStation({
    logging_service,
    authorization_service,
    signal_service,
    wake_lock_service,
});

export default parent_station;