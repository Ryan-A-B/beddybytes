import * as assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import * as cdk from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { SecretsStack } from '../lib/SecretsStack';
import { BackendStack } from '../lib/BackendStack';

test('environment bundles retain the legacy export and wire ECS and MQTT to matching fields', () => {
    const cwd = process.cwd();
    const previous = { ...process.env };
    const fixtureRoot = path.resolve(__dirname, '../../..', 'build');
    mkdirSync(fixtureRoot, { recursive: true });
    const fixture = mkdtempSync(path.join(fixtureRoot, 'bundle-test-'));
    try {
        mkdirSync(path.join(fixture, 'csr'));
        for (const env of ['qa', 'prod']) writeFileSync(path.join(fixture, 'csr', `${env}.csr`), 'test-csr');
        process.chdir(fixture);
        process.env.HOSTED_ZONE_ID = 'ZTEST';
        process.env.HOSTED_ZONE_NAME = 'beddybytes.com';
        process.env.MQTT_BROKER = 'test.iot.ap-southeast-2.amazonaws.com';
        const app = new cdk.App({ outdir: path.join(fixture, 'cdk.out') });
        const secrets = new SecretsStack(app, 'beddybytes-secrets');
        const resources = new cdk.Stack(app, 'resources');
        const vpc = cdk.aws_ec2.Vpc.fromVpcAttributes(resources, 'vpc', {
            vpcId: 'vpc-test', availabilityZones: ['ap-southeast-2a'], publicSubnetIds: ['subnet-test'],
        });
        const cluster = cdk.aws_ecs.Cluster.fromClusterAttributes(resources, 'cluster', {
            clusterName: 'test', vpc, securityGroups: [],
        });
        const bucket = cdk.aws_s3.Bucket.fromBucketName(resources, 'bucket', 'test-artifacts');
        const repository = cdk.aws_ecr.Repository.fromRepositoryName(resources, 'repository', 'test');
        const ip = new cdk.aws_ec2.CfnEIP(resources, 'ip');
        const stacks = (['qa', 'prod'] as const).map(env => {
            const bundle = secrets.backend_bundles[env];
            const stack = new BackendStack(app, `backend-${env}`, {
                deploy_env: env, secrets_bundle: bundle,
                docker_repository: repository, docker_image_digest: `sha256:${'a'.repeat(64)}`,
                iot_authorizer_sha: 'test-artifact', cluster, elastic_ip: ip, bucket,
            });
            return { env, bundle, stack };
        });
        for (const { env, bundle, stack } of stacks) {
            const template = Template.fromStack(stack);
            const tasks = Object.values(template.findResources('AWS::ECS::TaskDefinition')) as any[];
            const container = tasks[0].Properties.ContainerDefinitions[0];
            const names = container.Secrets.map((s: any) => s.Name).sort();
            assert.deepEqual(names, ['ENCRYPTION_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']);
            for (const secret of container.Secrets) {
                assert.deepEqual(secret.ValueFrom, stack.resolve(cdk.Fn.join('', [bundle.secretArn, `:${secret.Name}::`])));
            }
            assert.equal(container.Environment.some((e: any) => e.Name === 'GOOGLE_CLIENT_ID'), false);
            const hostPrefix = env === 'qa' ? 'qa.' : '';
            assert.deepEqual(container.Environment.find((e: any) => e.Name === 'GOOGLE_CALLBACK_URL'), {
                Name: 'GOOGLE_CALLBACK_URL', Value: `https://api.${hostPrefix}beddybytes.com/auth/google/callback`,
            });
            assert.deepEqual(container.Environment.find((e: any) => e.Name === 'FRONTEND_AUTH_REDIRECT'), {
                Name: 'FRONTEND_AUTH_REDIRECT', Value: `https://app.${hostPrefix}beddybytes.com/auth/callback`,
            });
            template.hasResourceProperties('AWS::Lambda::Function', {
                Environment: { Variables: Match.objectLike({
                    SIGNING_KEY_SECRET_ARN: stack.resolve(bundle.secretArn),
                    SIGNING_KEY_SECRET_JSON_FIELD: 'ENCRYPTION_KEY',
                }) },
            });
            template.hasResourceProperties('AWS::IAM::Policy', {
                PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({
                    Action: ['secretsmanager:GetSecretValue', 'secretsmanager:DescribeSecret'],
                    Resource: stack.resolve(bundle.secretArn),
                })]) },
            });
        }
        const template = Template.fromStack(secrets);
        template.resourceCountIs('AWS::SecretsManager::Secret', 4);
        for (const env of ['qa', 'prod']) {
            template.hasResource('AWS::SecretsManager::Secret', {
                Properties: { Name: `beddybytes-secrets-backend-${env}`, SecretString: JSON.stringify({
                    ENCRYPTION_KEY: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
                }) },
                DeletionPolicy: 'Retain', UpdateReplacePolicy: 'Retain',
            });
        }
        const exports = Object.values(template.toJSON().Outputs) as any[];
        assert.ok(exports.some(output => JSON.stringify(output.Value) === JSON.stringify(secrets.resolve(secrets.signing_key.secretArn))));
        app.synth();
    } finally {
        process.chdir(cwd);
        process.env = previous;
        rmSync(fixture, { recursive: true, force: true });
    }
});
