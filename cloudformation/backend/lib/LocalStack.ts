import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { domain_name, env_hosted_zone_or_throw, get_host_names } from './config';

interface StackProps extends cdk.StackProps {
    elastic_ip: cdk.aws_ec2.CfnEIP;
}

export class LocalStack extends cdk.Stack {
    constructor(scope: Construct, id_prefix: string, props: StackProps) {
        super(scope, id_prefix, props);

        new cdk.aws_route53.ARecord(this, 'api-dns', {
            zone: env_hosted_zone_or_throw(this),
            recordName: get_host_names(domain_name, 'local').api,
            ttl: cdk.Duration.minutes(15),
            target: cdk.aws_route53.RecordTarget.fromIpAddresses(props.elastic_ip.ref),
        });
    }
}
