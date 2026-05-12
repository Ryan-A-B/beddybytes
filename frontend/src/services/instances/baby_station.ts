import BabyStation from "../BabyStation";

import authorization_service from "./authorization_service";
import logging_service from "./logging_service";
import mqtt_service from "./mqtt_service";

const baby_station = new BabyStation({
    logging_service,
    authorization_service,
    mqtt_service,
})

export default baby_station;
