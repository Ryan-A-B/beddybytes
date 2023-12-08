import authorization_service from "./authorization_service";
import account_service from "./account_service";
import ConnectionService from "../services/ConnectionService";
import logging_service from "./logging_service";

const connection_service = new ConnectionService({
    logging_service,
    authorization_service,
    account_service,
});

export default connection_service;
