import { InfluxDB, WriteApi, WritePrecisionType, Point } from "@influxdata/influxdb-client";
import LoggingService, { LogInput, Severity } from ".";

type NewInfluxLoggingServiceInput = {
    client: InfluxDB
    org: string
    bucket: string
    client_id: string
    instance_id: string
}

class InfluxLoggingService implements LoggingService {
    private static WritePrecision: WritePrecisionType = 'ms';
    private static Facility = 'console';
    private static FacilityCode = 14;
    private static ApplicationName = 'frontend';
    private static HostName = 'beddybytes';
    private static Version = 1;

    private static SeverityCode: Record<Severity, string> = {
        [Severity.Emergency]: 'emerg',
        [Severity.Alert]: 'alert',
        [Severity.Critical]: 'crit',
        [Severity.Error]: 'err',
        [Severity.Warning]: 'warning',
        [Severity.Notice]: 'notice',
        [Severity.Informational]: 'info',
        [Severity.Debug]: 'debug',
    };

    private writer: WriteApi;
    private process_id: string;

    constructor(input: NewInfluxLoggingServiceInput) {
        this.writer = input.client.getWriteApi(input.org, input.bucket, InfluxLoggingService.WritePrecision);
        this.writer.useDefaultTags({
            facility: InfluxLoggingService.Facility,
            appname: InfluxLoggingService.ApplicationName,
            host: InfluxLoggingService.HostName,
            hostname: InfluxLoggingService.HostName,
        });
        this.process_id = `${input.client_id}:${input.instance_id}`;
    }

    public log = (input: LogInput) => {
        const severity_code = InfluxLoggingService.SeverityCode[input.severity];
        if (!severity_code)
            throw new Error(`Unknown severity code: ${input.severity}`);

        const point = new Point('syslog')
            .tag('severity', severity_code)
            .intField('facility_code', InfluxLoggingService.FacilityCode)
            .stringField('message', input.message)
            .stringField('process_id', this.process_id)
            .intField('severity_code', input.severity)
            .intField('version', InfluxLoggingService.Version);

        this.writer.writePoint(point);
    }
}

export default InfluxLoggingService;
