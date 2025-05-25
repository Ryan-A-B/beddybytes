import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { domain_name, env_hosted_zone_or_throw } from './config';

export class EmailStack extends cdk.Stack {
    constructor(scope: Construct, id_prefix: string, props?: cdk.StackProps) {
        super(scope, id_prefix, props);

        const hosted_zone = env_hosted_zone_or_throw(this);

        const email_identity = new cdk.aws_ses.EmailIdentity(this, 'email-identity', {
            identity: cdk.aws_ses.Identity.domain(domain_name),
        });

        email_identity.dkimRecords.forEach((dkim_record, index) => {
            const dns_record = new cdk.aws_route53.CnameRecord(this, `dkim-record-${index}`, {
                zone: hosted_zone,
                recordName: `${dkim_record.name}.`,
                domainName: dkim_record.value,
                ttl: cdk.Duration.minutes(15),
            });
        })
    }
}