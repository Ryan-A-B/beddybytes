import React from 'react';
import Service, { EventTypeStateChanged } from '../services/Service';

const useServiceState = <T>(service: Service<T>): T => {
    const [state, setState] = React.useState(service.get_state());
    React.useEffect(() => {
        const onStateChanged = () => {
            setState(service.get_state());
        };
        service.addEventListener(EventTypeStateChanged, onStateChanged);
        return () => {
            service.removeEventListener(EventTypeStateChanged, onStateChanged);
        };
    }, [service]);
    return state;
}

export default useServiceState;
