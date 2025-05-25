export interface Locker {
    lock: () => Promise<void>;
    unlock: () => void;
}

class WakeLocker implements Locker {
    private wakeLock: WakeLockSentinel | null = null;

    private isLocked = () => {
        return this.wakeLock !== null;
    }

    lock = async () => {
        if (this.isLocked()) return;
        this.wakeLock = await navigator.wakeLock.request('screen');
        document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    private onVisibilityChange = async () => {
        if (document.visibilityState !== 'visible') return;
        await this.reaqcuireLock();
    }

    private reaqcuireLock = async () => {
        this.wakeLock = await navigator.wakeLock.request('screen');
    }

    unlock = () => {
        if (this.wakeLock === null) return;
        this.wakeLock.release();
        document.removeEventListener('visibilitychange', this.onVisibilityChange);
        this.wakeLock = null;
    }
}

class NullLocker implements Locker {
    async lock() { }

    unlock() { }
}

const create_wake_locker = (): Locker => {
    if ('wakeLock' in navigator) return new WakeLocker();
    return new NullLocker();
}

let wakeLocker: Locker | null = null;
const get_wake_locker = (): Locker => {
    if (wakeLocker === null)
        wakeLocker = create_wake_locker();
    return wakeLocker;
}

export default get_wake_locker;
