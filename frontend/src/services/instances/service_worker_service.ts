import ServiceWorkerService from "../ServiceWorkerService";
import influx_logging_service from "./logging_service";

const service_worker_service = new ServiceWorkerService({
    logging_service: influx_logging_service,
});

export default service_worker_service;
