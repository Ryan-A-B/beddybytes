import ErrorService from "../ErrorService";
import logging_service from "./logging_service";

const error_service = new ErrorService({
    logging_service,
});

export default error_service;
