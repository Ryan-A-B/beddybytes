import BabyStation from "../BabyStation";

import authorization_service from "./authorization_service";
import logging_service from "./logging_service";

const baby_station = new BabyStation({
    logging_service,
    authorization_service,
})

export default baby_station;