import React from "react"
import ServiceWorkerService, { ServiceWorkerRegistrationStatus, EventTypeServiceWorkerRegistrationStatusChanged } from "../services/ServiceWorkerService"
import service_worker_service from "../instances/service_worker_service"

const useServiceWorkerRegistrationStatus = (service_worker_service: ServiceWorkerService): ServiceWorkerRegistrationStatus => {
    const [status, setStatus] = React.useState<ServiceWorkerRegistrationStatus>(service_worker_service.get_status);
    React.useEffect(() => {
        const handleStatusChange = () => {
            setStatus(service_worker_service.get_status());
        }
        service_worker_service.addEventListener(EventTypeServiceWorkerRegistrationStatusChanged, handleStatusChange);
        return () => {
            service_worker_service.removeEventListener(EventTypeServiceWorkerRegistrationStatusChanged, handleStatusChange);
        }
    }, [service_worker_service]);
    return status;
}

const UpdateAvailable: React.FunctionComponent = () => {
    const service_worker_registration_status = useServiceWorkerRegistrationStatus(service_worker_service);
    if (service_worker_registration_status.status !== 'registered') return null;
    const registration = service_worker_registration_status.registration;
    const waiting = registration.waiting;
    if (waiting === null) return null;
    return (
        <div className="alert alert-primary" role="alert">
            <div className="row align-items-center">
                <div className="col">
                    Update available
                </div>
                <div className="col-auto">
                    <button className="btn btn-primary btn-sm" onClick={service_worker_service.skip_waiting}>
                        Update
                    </button>
                </div>
            </div>
        </div>
    )
}

export default UpdateAvailable
