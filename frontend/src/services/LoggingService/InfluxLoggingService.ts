import { InfluxDB, WriteApi, WritePrecisionType, Point } from "@influxdata/influxdb-client";
import LoggingService, { LogInput, Severity } from ".";
import { build_hash, build_timestamp } from "../../utils/build_info";

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
    private account_id: string = 'no account';
    private client_id: string;
    private instance_id: string;
    private process_id: string;

    constructor(input: NewInfluxLoggingServiceInput) {
        this.writer = input.client.getWriteApi(input.org, input.bucket, InfluxLoggingService.WritePrecision);
        this.writer.useDefaultTags({
            host: window.location.hostname,
            facility: InfluxLoggingService.Facility,
            appname: InfluxLoggingService.ApplicationName,
            hostname: InfluxLoggingService.HostName,
            build_hash: build_hash,
            build_timestamp: build_timestamp,
        });
        this.client_id = input.client_id;
        this.instance_id = input.instance_id;
        this.process_id = `${input.client_id}:${input.instance_id}`;
    }

    public set_account_id = (account_id: string) => {
        this.account_id = account_id;
    }

    public log = (input: LogInput) => {
        const severity_code = InfluxLoggingService.SeverityCode[input.severity];
        if (!severity_code)
            throw new Error(`Unknown severity code: ${input.severity}`);

        const point = new Point('log')
            .stringField('user_agent', navigator.userAgent)
            .stringField("message", input.message)
            .tag('account_id', this.account_id)
            .tag('client_id', this.client_id)
            .tag('severity', severity_code)
            .stringField('instance_id', this.instance_id)

        this.writer.writePoint(point);

        this.old_log(input);
    }

    private old_log = (input: LogInput) => {
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
