import WebSocketSignalService from "../SignalService/WebSocketSignalService";
import QueueingDecorator from "../SignalService/QueueingDecorator";
import influx_logging_service from "./logging_service";
import authorization_service from "./authorization_service";

const websocket_signal_service = new WebSocketSignalService({
    logging_service: influx_logging_service,
    authorization_service,
});

const signal_service = new QueueingDecorator(websocket_signal_service);

export default signal_service;
