import { InfluxDB, WriteApi, WritePrecisionType, Point } from "@influxdata/influxdb-client";
import { Map } from "immutable";
import { LogInput, Severity } from "./models";

type NewInfluxLoggingServiceInput = {
    client: InfluxDB
    org: string
    bucket: string
    process_id: string
}

class InfluxLoggingService {
    private static WritePrecision: WritePrecisionType = 'ms';
    private static Facility = 'console';
    private static FacilityCode = 14;
    private static ApplicationName = 'frontend';
    private static HostName = 'babymonitor';
    private static Version = 1;

    private static SeverityCode = Map<Severity, string>().withMutations((map) => {
        map.set(Severity.Emergency, 'emerg');
        map.set(Severity.Alert, 'alert');
        map.set(Severity.Critical, 'crit');
        map.set(Severity.Error, 'err');
        map.set(Severity.Warning, 'warning');
        map.set(Severity.Notice, 'notice');
        map.set(Severity.Informational, 'info');
        map.set(Severity.Debug, 'debug');
    });

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
        this.process_id = input.process_id;
    }

    public log = (input: LogInput) => {
        const severity_code = InfluxLoggingService.SeverityCode.get(input.severity);
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
