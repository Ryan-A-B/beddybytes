
import LoggingService, { LogInput } from '../LoggingService';

class CompositeLoggingService implements LoggingService {
    private services: LoggingService[];

    constructor(services: LoggingService[]) {
        this.services = services;
    }

    public log = (input: LogInput) => {
        this.services.forEach((service) => service.log(input));
    }
}

export default CompositeLoggingService;