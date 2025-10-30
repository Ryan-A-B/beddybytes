import * as path from 'path';
import { readFileSync } from 'fs';

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeployEnv, domain_name, env_hosted_zone_or_throw, env_string_or_throw, get_host_names } from './config';

const memory_limit_by_env: Record<DeployEnv, number> = {
    prod: 128,
    qa: 64,
};

interface StackProps extends cdk.StackProps {
    deploy_env: DeployEnv;
    docker_repository: cdk.aws_ecr.IRepository;
    docker_image_digest: string;
    cluster: cdk.aws_ecs.ICluster;
    signing_key: cdk.aws_secretsmanager.ISecret;
    elastic_ip: cdk.aws_ec2.CfnEIP;
}

export class BackendStack extends cdk.Stack {
    constructor(scope: Construct, id_prefix: string, props: StackProps) {
        super(scope, id_prefix, props);
        const hosted_zone = env_hosted_zone_or_throw(this);
        const host_names = get_host_names(domain_name, props.deploy_env);
        const traefik_router_prefix = `${props.deploy_env}-`;

        const api_container_image = cdk.aws_ecs.ContainerImage.fromEcrRepository(props.docker_repository, props.docker_image_digest);

        const execution_role = new cdk.aws_iam.Role(this, `execution-role`, {
            assumedBy: new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });

        const task_role = new cdk.aws_iam.Role(this, `task-role`, {
            assumedBy: new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });

        const task_definition = new cdk.aws_ecs.Ec2TaskDefinition(this, `task-definition`, {
            executionRole: execution_role,
            taskRole: task_role,
            volumes: [
                {
                    name: 'keys',
                    host: {
                        sourcePath: `/ebs/persistent/keys/${props.deploy_env}`,
                    },
                },
                {
                    name: 'eventlog',
                    host: get_eventlog_host_path(props.deploy_env),
                }
            ],
        });
        const api_container = task_definition.addContainer(`api`, {
            image: api_container_image,
            essential: true,
            enableRestartPolicy: true,
            memoryLimitMiB: memory_limit_by_env[props.deploy_env],
            portMappings: [{ containerPort: 9000 }],
            environment: {
                'COOKIE_DOMAIN': `.${domain_name}`,
                'SERVER_ADDR': ':9000',
                'FILE_EVENT_LOG_FOLDER_PATH': '/opt/eventlog',
                'MAILER_IMPLEMENTATION': 'ses',
                'MAILER_SES_FROM': `BeddyBytes <noreply@${domain_name}>`,
                'MAILER_SES_APP_HOST': host_names.app,
                'AWS_REGION': this.region,
                'MQTT_IMPLEMENTATION': 'aws_iot',
                'MQTT_CLIENT_ID': `backend-${props.deploy_env}`,
                'MQTT_BROKER': env_string_or_throw('MQTT_BROKER'),
                'MQTT_AWS_IOT_ROOT_CA_FILE': 'keys/AmazonRootCA1.pem',
                'MQTT_AWS_IOT_CERT_FILE': 'keys/certificate.crt',
                'MQTT_AWS_IOT_KEY_FILE': 'keys/private_key.pem',
            },
            secrets: {
                'ENCRYPTION_KEY': cdk.aws_ecs.Secret.fromSecretsManager(props.signing_key),
            },
            dockerLabels: {
                'traefik.enable': 'true',

                [`traefik.http.routers.${traefik_router_prefix}anonymous-token.rule`]: `Host(\`${host_names.api}\`) && Path(\`/anonymous_token\`) && Method(\`POST\`)`,
                [`traefik.http.routers.${traefik_router_prefix}anonymous-token.entrypoints`]: "websecure",
                [`traefik.http.routers.${traefik_router_prefix}anonymous-token.tls`]: "true",
                [`traefik.http.routers.${traefik_router_prefix}anonymous-token.tls.certresolver`]: "letsencrypt",
                [`traefik.http.routers.${traefik_router_prefix}anonymous-token.middlewares`]: "headers-cors@file,rate-limit-anonymous-token@file",

                [`traefik.http.routers.${traefik_router_prefix}create-account.rule`]: `Host(\`${host_names.api}\`) && Path(\`/accounts\`) && Method(\`POST\`)`,
                [`traefik.http.routers.${traefik_router_prefix}create-account.entrypoints`]: "websecure",
                [`traefik.http.routers.${traefik_router_prefix}create-account.tls`]: "true",
                [`traefik.http.routers.${traefik_router_prefix}create-account.tls.certresolver`]: "letsencrypt",
                [`traefik.http.routers.${traefik_router_prefix}create-account.middlewares`]: "headers-cors@file,rate-limit-create-account@file",

                [`traefik.http.routers.${traefik_router_prefix}api.rule`]: `Host(\`${host_names.api}\`)`,
                [`traefik.http.routers.${traefik_router_prefix}api.entrypoints`]: "websecure",
                [`traefik.http.routers.${traefik_router_prefix}api.tls`]: "true",
                [`traefik.http.routers.${traefik_router_prefix}api.tls.certresolver`]: "letsencrypt",
                [`traefik.http.routers.${traefik_router_prefix}api.middlewares`]: "headers-cors@file,rate-limit-api@file",
            },
        });
        api_container.addMountPoints({
            sourceVolume: 'keys',
            containerPath: '/opt/keys',
            readOnly: true,
        });
        api_container.addMountPoints({
            sourceVolume: 'eventlog',
            containerPath: '/opt/eventlog',
            readOnly: false,
        });

        const service = new cdk.aws_ecs.Ec2Service(this, `service`, {
            cluster: props.cluster,
            taskDefinition: task_definition,
            desiredCount: 1,
            minHealthyPercent: 0,
            maxHealthyPercent: 100,
        });

        const api_dns_record = new cdk.aws_route53.ARecord(this, `api-dns`, {
            zone: hosted_zone,
            recordName: host_names.api,
            ttl: cdk.Duration.minutes(15),
            target: cdk.aws_route53.RecordTarget.fromIpAddresses(props.elastic_ip.ref as string),
        });

        const thing = new cdk.aws_iot.CfnThing(this, `thing`);

        const csrPath = path.join('csr', `${props.deploy_env}.csr`);
        const csr = readFileSync(csrPath, 'utf8');

        const certificate = new cdk.aws_iot.CfnCertificate(this, `thing-certificate`, {
            status: 'ACTIVE',
            certificateMode: 'DEFAULT',
            certificateSigningRequest: csr,
        });

        const principal_attachment = new cdk.aws_iot.CfnThingPrincipalAttachment(this, `thing-principal-attachment`, {
            principal: certificate.attrArn,
            thingName: thing.ref,
        });

        const policy = new cdk.aws_iot.CfnPolicy(this, `thing-policy`, {
            policyDocument: new cdk.aws_iam.PolicyDocument({
                statements: [
                    new cdk.aws_iam.PolicyStatement({
                        effect: cdk.aws_iam.Effect.ALLOW,
                        actions: [
                            "iot:Connect",
                            "iot:Publish",
                            "iot:Subscribe",
                            "iot:Receive",
                        ],
                        resources: ['*'],
                    }),
                ],
            }),
        });

        const policy_attachment = new cdk.aws_iot.CfnPolicyPrincipalAttachment(this, `thing-policy-attachment`, {
            policyName: policy.ref,
            principal: certificate.attrArn,
        });

        const bucket = new cdk.aws_s3.Bucket(this, "bucket", {
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        const authorizer_function = new cdk.aws_lambda.Function(this, "authorizer-function", {
            architecture: cdk.aws_lambda.Architecture.ARM_64,
            runtime: cdk.aws_lambda.Runtime.PROVIDED_AL2023,
            code: cdk.aws_lambda.Code.fromBucketV2(bucket, 'iot-authorizer.zip'),
            handler: 'bootstrap',
        });

        authorizer_function.addEnvironment("AWS_ACCOUNT_ID", this.account);
        authorizer_function.addEnvironment("ENCRYPTION_KEY_ARN", props.signing_key.secretArn);
        props.signing_key.grantRead(authorizer_function);

        const authorizer = new cdk.aws_iot.CfnAuthorizer(this, "authorizer", {
            authorizerFunctionArn: authorizer_function.functionArn,
            signingDisabled: true,
            enableCachingForHttp: true,
            status: 'ACTIVE',
        });

        authorizer_function.addPermission("allow-iot-invoke", {
            principal: new cdk.aws_iam.ServicePrincipal("iot.amazonaws.com"),
            action: "lambda:InvokeFunction",
            sourceArn: authorizer.attrArn,
        });

    }
}

const get_eventlog_host_path = (deploy_env: DeployEnv): cdk.aws_ecs.Host | undefined => {
    if (deploy_env !== 'prod') return undefined;
    return {
        sourcePath: '/ebs/persistent/eventlog',
    }
}
