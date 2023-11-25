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
    const update = React.useCallback(() => {
        if (service_worker_registration_status.status !== 'registered')
            throw new Error('Service worker is not registered');
        const registration = service_worker_registration_status.registration;
        const waiting = registration.waiting;
        if (waiting === null)
            throw new Error('Service worker is not waiting');
        waiting.addEventListener('statechange', (event) => {
            const state = (event.target as ServiceWorker).state;
            if (state === 'activated') {
                window.location.reload();
            }
        });
        waiting.postMessage({ type: 'SKIP_WAITING' });
    }, [service_worker_registration_status]);
    if (service_worker_registration_status.status !== 'registered') return null;
    const registration = service_worker_registration_status.registration;
    const waiting = registration.waiting;
    if (waiting === null) return null;
    return (
        <div className="alert alert-primary" role="alert">
            <p>Update available</p>
            <button className="btn btn-primary" onClick={update}>
                Update
            </button>
        </div>
    )
}

export default UpdateAvailable
