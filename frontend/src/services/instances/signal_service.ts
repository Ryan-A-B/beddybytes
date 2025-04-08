import WebSocketSignalService from "../SignalService/WebSocketSignalService";
import influx_logging_service from "./logging_service";
import authorization_service from "./authorization_service";

const signal_service = new WebSocketSignalService({
    logging_service: influx_logging_service,
    authorization_service,
});

export default signal_service;
