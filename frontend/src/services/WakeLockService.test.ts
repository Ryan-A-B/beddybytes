import Service, { EventTypeStateChanged, ServiceState } from "./Service";
import { LogInput } from "./LoggingService";
import WakeLockService from "./WakeLockService";

beforeEach(() => {
    (navigator as any).wakeLock = {
        request: jest.fn(async () => new MockWakeLockSentinel()),
    };
});

describe('WakeLockService', () => {
    test('normal operation', async () => {
        const logging_service = new MockLoggingService();
        const wake_lock_service = new WakeLockService({
            logging_service,
        });
        expect(wake_lock_service.get_state().name).toBe('available');

        expect(navigator.wakeLock.request).toHaveBeenCalledTimes(0);

        wake_lock_service.lock();
        expect(navigator.wakeLock.request).toHaveBeenCalledTimes(1);
        expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
        expect(wake_lock_service.get_state().name).toBe('locking');

        await wait_for_state_change(wake_lock_service);
        expect(wake_lock_service.get_state().name).toBe('locked');

        wake_lock_service.unlock();
        expect(wake_lock_service.get_state().name).toBe('unlocking');

        await wait_for_state_change(wake_lock_service);
        expect(wake_lock_service.get_state().name).toBe('available');
    });

    describe('release event while locked', () => {
        test('then lock', async () => {
            const logging_service = new MockLoggingService();
            const wake_lock_service = new WakeLockService({
                logging_service,
            });
            wake_lock_service.lock();
            await wait_for_state_change(wake_lock_service);
            expect(wake_lock_service.get_state().name).toBe('locked');

            // @ts-ignore
            const sentinel = wake_lock_service.get_state().sentinel;
            sentinel.dispatchEvent(new Event('release'));

            expect(wake_lock_service.get_state().name).toBe('lock_lost');
            wake_lock_service.lock();
            expect(wake_lock_service.get_state().name).toBe('locking');
            await wait_for_state_change(wake_lock_service);
            expect(wake_lock_service.get_state().name).toBe('locked');
        });
        test('then unlock', async () => {
            const logging_service = new MockLoggingService();
            const wake_lock_service = new WakeLockService({
                logging_service,
            });
            wake_lock_service.lock();
            await wait_for_state_change(wake_lock_service);
            expect(wake_lock_service.get_state().name).toBe('locked');

            // @ts-ignore
            const sentinel = wake_lock_service.get_state().sentinel;
            sentinel.dispatchEvent(new Event('release'));

            expect(wake_lock_service.get_state().name).toBe('lock_lost');
            wake_lock_service.unlock();
            expect(wake_lock_service.get_state().name).toBe('available');
        });
    });

    test('unlock while locking', async () => {
        const logging_service = new MockLoggingService();
        const wake_lock_service = new WakeLockService({
            logging_service,
        });
        expect(wake_lock_service.get_state().name).toBe('available');
        wake_lock_service.lock();
        expect(wake_lock_service.get_state().name).toBe('locking');
        wake_lock_service.unlock();
        expect(wake_lock_service.get_state().name).toBe('available');
    });

    test('lock while unlocking', async () => {
        const logging_service = new MockLoggingService();
        const wake_lock_service = new WakeLockService({
            logging_service,
        });
        expect(wake_lock_service.get_state().name).toBe('available');
        wake_lock_service.lock();
        await wait_for_state_change(wake_lock_service);
        expect(wake_lock_service.get_state().name).toBe('locked');
        wake_lock_service.unlock();
        expect(wake_lock_service.get_state().name).toBe('unlocking');
        wake_lock_service.lock();
        expect(wake_lock_service.get_state().name).toBe('preparing_to_lock_after_unlocking');
        await wait_for_state_change(wake_lock_service);
        expect(wake_lock_service.get_state().name).toBe('locked');
    });

    test('request rejected', async () => {
        (navigator as any).wakeLock = {
            request: jest.fn(() => {
                return Promise.reject(new Error('Request failed'));
            }),
        };
        const logging_service = new MockLoggingService();
        const wake_lock_service = new WakeLockService({
            logging_service,
        });
        expect(wake_lock_service.get_state().name).toBe('available');
        wake_lock_service.lock();
        expect(wake_lock_service.get_state().name).toBe('locking');
        await wait_for_state_change(wake_lock_service);
        expect(wake_lock_service.get_state().name).toBe('available');
    });
});

async function wait_for_state_change<T extends ServiceState>(service: Service<T>): Promise<T> {
    return new Promise((resolve) => {
        service.addEventListener(EventTypeStateChanged, () => {
            resolve(service.get_state());
        });
    });
}

class MockLoggingService {
    set_account_id(account_id: string): void {
        // do nothing
    }

    log(input: LogInput): void {
        // do nothing
    }
}

class MockWakeLockSentinel extends EventTarget {
    release = jest.fn(async () => undefined);
}