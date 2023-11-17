import EventService from "../services/EventService";
import connection_service from "./connection_service";

const event_service = new EventService({
    connection_service,
});

export default event_service;
