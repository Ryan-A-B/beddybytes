import EventService from "../services/EventService";
import authorization_service from "./authorization_service";

const event_service = new EventService({
    authorization_service,
});

export default event_service;
