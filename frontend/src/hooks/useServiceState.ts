import React from 'react';
import Service from '../services/Service';

const useServiceState = <T>(service: Service<T>): T => {
    const [state, setState] = React.useState(service.get_state());
    React.useEffect(() => {
        const onStateChanged = () => {
            setState(service.get_state());
        };
        service.addEventListener('state_changed', onStateChanged);
        return () => {
            service.removeEventListener('state_changed', onStateChanged);
        };
    }, [service]);
    return state;
}

export default useServiceState;
