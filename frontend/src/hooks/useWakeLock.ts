import React from 'react';
import getWakeLocker from '../WakeLock';

const useWakeLock = (locked: boolean) => {
    React.useEffect(() => {
        if (!locked) return;
        const wakeLocker = getWakeLocker();
        wakeLocker.lock();
        return wakeLocker.unlock;
    }, [locked]);
}

export default useWakeLock;
