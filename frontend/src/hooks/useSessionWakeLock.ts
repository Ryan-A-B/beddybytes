import React from 'react';
import { Session } from '../Sessions/Sessions';
import getWakeLocker from '../WakeLock';

const useSessionWakeLock = (session: Session | null) => {
    React.useEffect(() => {
        if (session === null) return;
        const wakeLocker = getWakeLocker();
        wakeLocker.lock();
        return wakeLocker.unlock;
    }, [session]);
}

export default useSessionWakeLock;
