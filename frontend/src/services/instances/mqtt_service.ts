import MQTTService from "../MQTTService";
import disconnect_on_monitor_scope_loss from "../disconnect_on_monitor_scope_loss";
import authorization_service from "./authorization_service";
import logging_service from "./logging_service";

const mqtt_service = new MQTTService({
    authorization_service,
    logging_service,
});

disconnect_on_monitor_scope_loss(authorization_service, mqtt_service);

export default mqtt_service;
