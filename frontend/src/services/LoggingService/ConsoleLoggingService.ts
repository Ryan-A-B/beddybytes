import Severity from "./Severity";


class ConsoleLoggingService implements LoggingService {
    public log(input: LogInput): void {
        this.get_log_func(input.severity)(`${input.severity}: ${input.message}`);
    }

    private get_log_func = (severity: Severity) => {
        if (severity <= Severity.Error) return console.error
        return console.log
    }
}

export default ConsoleLoggingService;
