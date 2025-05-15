import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export const domain_name = 'beddybytes.com';
export type DeployEnv = 'prod' | 'staging';

export const env_string_or_throw = (key: string): string => {
    const value = process.env[key];
    if (value === undefined) throw new Error(`Environment variable ${key} is not set`);
    return value;
};

export const env_hosted_zone_or_throw = (scope: Construct): cdk.aws_route53.IHostedZone => (
    cdk.aws_route53.HostedZone.fromHostedZoneAttributes(scope, 'hosted-zone', {
        hostedZoneId: env_string_or_throw('HOSTED_ZONE_ID'),
        zoneName: env_string_or_throw('HOSTED_ZONE_NAME'),
    })
);

export interface HostNames {
    app: string; // TODO this shouldn't be necessary. The BE needs to use info from the request instead
    api: string;
    influxdb: string;
    grafana: string;
}

export const get_host_names = (domain_name: string, deploy_env: string): HostNames => {
    const env_prefix = get_env_host_name_prefix(deploy_env);
    return {
        app: `app.${env_prefix}${domain_name}`,
        api: `api.${env_prefix}${domain_name}`,
        influxdb: `influxdb.${env_prefix}${domain_name}`,
        grafana: `grafana.${env_prefix}${domain_name}`,
    };
};

const get_env_host_name_prefix = (deploy_env: string): string => {
    if (deploy_env === 'prod') return '';
    return `${deploy_env}.`;
};
