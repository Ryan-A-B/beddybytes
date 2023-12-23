import EventService from "../EventService";
import influx_logging_service from "./logging_service";
import authorization_service from "./authorization_service";

const event_service = new EventService({
    logging_service: influx_logging_service,
    authorization_service,
});

export default event_service;
