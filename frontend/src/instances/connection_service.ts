import authorization_service from "./authorization_service";
import account_service from "./account_service";
import ConnectionService from "../services/ConnectionService";

const connection_service = new ConnectionService({
    authorization_service,
    account_service,
});

export default connection_service;
