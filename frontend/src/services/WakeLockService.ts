import LoggingService, { Severity } from "./LoggingService";
import Service, { SetStateFunction } from "./Service";

interface ServiceProxy {
    logging_service: LoggingService;
    handle_release: () => void;
    get_state: () => WakeLockState;
    set_state: SetStateFunction<WakeLockState>;
}

abstract class AbstractState {
    abstract readonly name: string;
    abstract lock(service: ServiceProxy): void;
    abstract unlock(service: ServiceProxy): void;
    abstract handle_request_resolved(service: ServiceProxy, sentinel: WakeLockSentinel): void;
    abstract handle_request_rejected(service: ServiceProxy): void;
    abstract handle_release_resolved(service: ServiceProxy): void;
    abstract handle_release(service: ServiceProxy): void;
}

class Unavailable extends AbstractState {
    readonly name = 'unavailable';

    lock = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::lock called in Unavailable state',
        });
    }

    unlock = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::unlock called in Unavailable state',
        });
    }

    handle_request_resolved = (service: ServiceProxy, sentinel: WakeLockSentinel) => {
        // This should never be called in Unavailable state
        throw new Error('WakeLockService::handle_request_resolved called in Unavailable state');
    }

    handle_request_rejected = (service: ServiceProxy) => {
        // This should never be called in Unavailable state
        throw new Error('WakeLockService::handle_request_rejected called in Unavailable state');
    }

    handle_release_resolved = (service: ServiceProxy) => {
        // This should never be called in Unavailable state
        throw new Error('WakeLockService::handle_release_resolved called in Unavailable state');
    }

    handle_release = (service: ServiceProxy) => {
        // This should never be called in Unavailable state
        throw new Error('WakeLockService::handle_release called in Unavailable state');
    }
}

class Available extends AbstractState {
    readonly name = 'available';

    lock = (service: ServiceProxy) => {
        service.set_state(new Locking());
        navigator.wakeLock.request('screen')
            .then((sentinel) => service.get_state().handle_request_resolved(service, sentinel))
            .catch(() => service.get_state().handle_request_rejected(service));
    }

    unlock = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::unlock called in Available state',
        });
    }

    handle_request_resolved = (service: ServiceProxy, sentinel: WakeLockSentinel) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_request_resolved called in Available state',
        });
        sentinel.release();
    }

    handle_request_rejected = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_request_rejected called in Available state',
        });
    }

    handle_release_resolved = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_release_resolved called in Available state',
        });
    }

    handle_release = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_release called in Available state',
        });
    }
}

class LockLost extends AbstractState {
    readonly name = 'lock_lost';

    lock = (service: ServiceProxy) => {
        service.set_state(new Locking());
        navigator.wakeLock.request('screen')
            .then((sentinel) => service.get_state().handle_request_resolved(service, sentinel))
            .catch(() => service.get_state().handle_request_rejected(service));
    }

    unlock = (service: ServiceProxy) => {
        service.set_state(new Available());
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::unlock called in LockLost state',
        });
    }

    handle_request_resolved = (service: ServiceProxy, sentinel: WakeLockSentinel) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_request_resolved called in LockLost state',
        });
        sentinel.release();
    }

    handle_request_rejected = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_request_rejected called in LockLost state',
        });
    }

    handle_release_resolved = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_release_resolved called in LockLost state',
        });
    }

    handle_release = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_release called in LockLost state',
        });
    }
}

class Locking extends AbstractState {
    readonly name = 'locking';

    lock = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::lock called in Locking state',
        });
    }

    unlock = (service: ServiceProxy) => {
        service.set_state(new Available());
    }

    handle_request_resolved = (service: ServiceProxy, sentinel: WakeLockSentinel) => {
        service.set_state(new Locked(sentinel));
        sentinel.addEventListener('release', service.handle_release);
    }

    handle_request_rejected = (service: ServiceProxy) => {
        service.set_state(new Available());
    }

    handle_release_resolved = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_release_resolved called in Locking state',
        });
    }

    handle_release = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_release called in Locking state',
        });
    }
}

class Locked extends AbstractState {
    readonly name = 'locked';
    private sentinel: WakeLockSentinel;

    constructor(sentinel: WakeLockSentinel) {
        super();
        this.sentinel = sentinel;
    }

    lock = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::lock called in Locked state',
        });
    }

    unlock = (service: ServiceProxy) => {
        service.set_state(new Unlocking());
        this.sentinel.removeEventListener('release', service.handle_release);
        this.sentinel.release().then(() => {
            service.get_state().handle_release_resolved(service);
        });
    }

    handle_request_resolved = (service: ServiceProxy, sentinel: WakeLockSentinel) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_request_resolved called in Locked state',
        });
    }

    handle_request_rejected = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_request_rejected called in Locked state',
        });
    }

    handle_release_resolved = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_release_resolved called in Locked state',
        });
    }

    handle_release = (service: ServiceProxy) => {
        service.set_state(new LockLost());
    }
}

class Unlocking extends AbstractState {
    readonly name = 'unlocking';

    lock = (service: ServiceProxy) => {
        service.set_state(new PreparingToLockAfterUnlocking());
        // TODO if request is called while unlocking, we should reacquire
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::lock called in Unlocking state',
        });
    }

    unlock = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::unlock called in Unlocking state',
        });
    }

    handle_request_resolved = (service: ServiceProxy, sentinel: WakeLockSentinel) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_request_resolved called in Unlocking state',
        });
    }

    handle_request_rejected = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_request_rejected called in Unlocking state',
        });
    }

    handle_release_resolved = (service: ServiceProxy) => {
        service.set_state(new Available());
    }

    handle_release = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_release called in Unlocking state',
        });
    }
}

class PreparingToLockAfterUnlocking extends AbstractState {
    readonly name = 'preparing_to_lock_after_unlocking';

    lock = (service: ServiceProxy) => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::lock called in PreparingToLockAfterUnlocking state',
        });
    }

    unlock = (service: ServiceProxy) => {
        service.set_state(new Unlocking());
    }

    handle_request_resolved = (service: ServiceProxy, sentinel: WakeLockSentinel): void => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_request_resolved called in PreparingToLockAfterUnlocking state',
        });
    }

    handle_request_rejected = (service: ServiceProxy): void => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_request_rejected called in PreparingToLockAfterUnlocking state',
        });
    }

    handle_release_resolved = (service: ServiceProxy): void => {
        service.set_state(new Locking());
        navigator.wakeLock.request('screen')
            .then((sentinel) => service.get_state().handle_request_resolved(service, sentinel))
            .catch(() => service.get_state().handle_request_rejected(service));
    }

    handle_release = (service: ServiceProxy): void => {
        service.logging_service.log({
            severity: Severity.Notice,
            message: 'WakeLockService::handle_release called in PreparingToLockAfterUnlocking state',
        });
    }
}

type WakeLockState = Unavailable | Available | Locking | Locked | LockLost | Unlocking | PreparingToLockAfterUnlocking;

interface NewWakeLockServiceInput {
    logging_service: LoggingService;
}

class WakeLockService extends Service<WakeLockState> {
    protected readonly name = 'WakeLockService';
    private readonly proxy: ServiceProxy;

    constructor(input: NewWakeLockServiceInput) {
        super({
            logging_service: input.logging_service,
            initial_state: WakeLockService.get_initial_state(),
        });
        this.proxy = {
            logging_service: input.logging_service,
            handle_release: this.handle_release,
            get_state: this.get_state,
            set_state: this.set_state,
        };
    }

    protected to_string = (state: WakeLockState): string => {
        return state.name;
    }

    public lock = () => {
        this.get_state().lock(this.proxy);
    }

    public unlock = () => {
        this.get_state().unlock(this.proxy);
    }

    private handle_release = () => {
        this.get_state().handle_release(this.proxy);
    }

    private static get_initial_state = (): WakeLockState => {
        const wake_lock_unavailable = navigator.wakeLock === undefined;
        if (wake_lock_unavailable)
            return new Unavailable();
        return new Available();
    }
}

export default WakeLockService;