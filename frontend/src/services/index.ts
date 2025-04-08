import React from "react"

import LoggingService from "./LoggingService"
import WebSocketSignalService from "./SignalService/WebSocketSignalService";

export type Services = {
    logging_service: LoggingService,
    authorization_service: AuthorizationService,
    signal_service: WebSocketSignalService,
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
export const useSignalService = makeUseService('signal_service');
