import React from 'react';
import wake_lock_service from '../services/instances/wake_lock_service';

const useWakeLock = (locked: boolean) => {
    React.useEffect(() => {
        if (!locked) return;
        wake_lock_service.lock();
        return wake_lock_service.unlock;
    }, [locked]);
}

export default useWakeLock;
