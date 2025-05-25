import React from 'react';
import get_wake_locker from '../WakeLock';

const useWakeLock = (locked: boolean) => {
    React.useEffect(() => {
        if (!locked) return;
        const wake_locker = get_wake_locker();
        wake_locker.lock();
        return wake_locker.unlock;
    }, [locked]);
}

export default useWakeLock;
