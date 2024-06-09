import React from "react"

import EventService from "./EventService"
import LoggingService from "./LoggingService"

export type Services = {
    logging_service: LoggingService,
    authorization_service: AuthorizationService,
    event_service: EventService,
    signal_service: SignalService,
}

export const context = React.createContext<Nullable<Services>>(null);

type UseService<K extends keyof Services> = () => Services[K];

function makeUseService<K extends keyof Services>(key: K): UseService<K> {
    return () => {
        const services = React.useContext(context);
        if (services === null)
            throw new Error('useService must be used within a ServiceProvider');
        return services[key]
    };
}

export const useLoggingService = makeUseService('logging_service');
export const useAuthorizationService = makeUseService('authorization_service');
export const useEventService = makeUseService('event_service');
export const useSignalService = makeUseService('signal_service');
