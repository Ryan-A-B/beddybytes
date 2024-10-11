import LoggingService, { LogInput, Severity } from ".";

class ConsoleLoggingService implements LoggingService {
    private static SeverityLabel: Record<Severity, string> = {
        [Severity.Emergency]: 'Emergency',
        [Severity.Alert]: 'Alert',
        [Severity.Critical]: 'Critical',
        [Severity.Error]: 'Error',
        [Severity.Warning]: 'Warning',
        [Severity.Notice]: 'Notice',
        [Severity.Informational]: 'Informational',
        [Severity.Debug]: 'Debug',
    }

    public log(input: LogInput): void {
        const label = ConsoleLoggingService.SeverityLabel[input.severity];
        this.get_log_func(input.severity)(`${label}: ${input.message}`);
    }

    public set_account_id(account_id: string): void {
        // Do nothing
    }

    private get_log_func = (severity: Severity) => {
        if (severity <= Severity.Warning) return console.error
        return console.log
    }
}

export default ConsoleLoggingService;
