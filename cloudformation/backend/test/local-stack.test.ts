import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { LocalStack } from '../lib/LocalStack';

test('local stack contains only the API DNS record targeting the shared ingress', () => {
    const previous = { ...process.env };
    try {
        process.env.HOSTED_ZONE_ID = 'ZTEST';
        process.env.HOSTED_ZONE_NAME = 'beddybytes.com';
        const app = new cdk.App();
        const core = new cdk.Stack(app, 'core');
        const ip = new cdk.aws_ec2.CfnEIP(core, 'ip');
        const local = new LocalStack(app, 'beddybytes-backend-local', { elastic_ip: ip });
        const template = Template.fromStack(local);

        assert.equal(Object.keys(template.toJSON().Resources).length, 1);
        template.hasResourceProperties('AWS::Route53::RecordSet', {
            HostedZoneId: 'ZTEST',
            Name: 'api.local.beddybytes.com.',
            Type: 'A',
            TTL: '900',
            ResourceRecords: [local.resolve(ip.ref)],
        });
        assert.ok(local.dependencies.includes(core));
    } finally {
        process.env = previous;
    }
});
