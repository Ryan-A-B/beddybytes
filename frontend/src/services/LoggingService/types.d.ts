interface LogInput {
    severity: Severity,
    message: string,
}

interface LoggingService {
    log: (input: LogInput) => void
}
