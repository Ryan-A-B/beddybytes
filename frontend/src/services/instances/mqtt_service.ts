import MQTTService from "../MQTTService";
import authorization_service from "./authorization_service";
import logging_service from "./logging_service";

const mqtt_service = new MQTTService({
    authorization_service,
    logging_service,
});

export default mqtt_service;
