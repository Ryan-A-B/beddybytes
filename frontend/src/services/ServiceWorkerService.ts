export const EventTypeServiceWorkerRegistrationStatusChanged = 'service_worker_registration_status_changed';

interface ServiceWorkerRegistrationStatusNotAvailable {
    status: 'not_available';
}

interface ServiceWorkerRegistrationStatusAvailable {
    status: 'available';
}

interface ServiceWorkerRegistrationStatusRegistered {
    status: 'registered';
    registration: ServiceWorkerRegistration;
}

interface ServiceWorkerRegistrationStatusFailed {
    status: 'failed';
    error: unknown;
}

export type ServiceWorkerRegistrationStatus =
    ServiceWorkerRegistrationStatusNotAvailable |
    ServiceWorkerRegistrationStatusAvailable |
    ServiceWorkerRegistrationStatusRegistered |
    ServiceWorkerRegistrationStatusFailed;

class ServiceWorkerService extends EventTarget {
    private static should_skip_registration = process.env.NODE_ENV === 'development';
    private status: ServiceWorkerRegistrationStatus;

    constructor() {
        super();
        const service_worker_available = 'serviceWorker' in navigator;
        if (!service_worker_available) {
            this.status = { status: 'not_available' };
            return;
        }
        this.status = { status: 'available' };
    }

    public get_status = (): ServiceWorkerRegistrationStatus => {
        return this.status;
    }

    private set_status = (status: ServiceWorkerRegistrationStatus): void => {
        this.status = status;
        this.dispatchEvent(new Event(EventTypeServiceWorkerRegistrationStatusChanged));
    }

    public register_service_worker = async (): Promise<void> => {
        if (this.status.status !== 'available') return;
        if (ServiceWorkerService.should_skip_registration) return;
        try {
            const registration = await navigator.serviceWorker.register(`/service-worker.js`, { scope: '/' });
            this.set_status({ status: 'registered', registration });
        } catch (error) {
            this.set_status({ status: 'failed', error });
        }
    }
}

export default ServiceWorkerService;
