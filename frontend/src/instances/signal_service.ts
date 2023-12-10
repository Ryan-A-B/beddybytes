import WebSocketSignalService from "../services/SignalService.ts/WebSocketSignalService";
import logging_service from "./logging_service";
import authorization_service from "./authorization_service";

const signal_service = new WebSocketSignalService({
    logging_service,
    authorization_service,
});

export default signal_service;
