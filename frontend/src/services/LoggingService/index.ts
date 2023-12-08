import { LogInput } from "./models";

interface LoggingService {
    log: (input: LogInput) => void
}

export default LoggingService;