import logging_service from "./logging_service";
import WakeLockService from "../WakeLockService";

const wake_lock_service = new WakeLockService({
    logging_service,
});

export default wake_lock_service;
