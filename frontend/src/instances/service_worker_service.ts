import ServiceWorkerService from "../services/ServiceWorkerService";
import logging_service from "./logging_service";

const service_worker_service = new ServiceWorkerService({
    logging_service,
});

export default service_worker_service;
