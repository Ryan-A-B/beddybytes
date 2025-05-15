import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { env_string_or_throw, get_host_names } from '../config';

interface AddAPIInput {
    scope: Construct;
    id_prefix: string;
    deploy_env: string;
    domain_name: string;
    cluster: cdk.aws_ecs.ICluster;
    traefik_prefix: string;

    hosted_zone: cdk.aws_route53.IHostedZone;
    elastic_ip: cdk.aws_ec2.CfnEIP;

    container_image: cdk.aws_ecs.ContainerImage;
}

export const add_api = (input: AddAPIInput) => {
    const host_names = get_host_names(input.domain_name, input.deploy_env);
    const host_name = host_names.api;

    const encryption_key = new cdk.aws_secretsmanager.Secret(input.scope, `${input.id_prefix}encryption-key`);

    const execution_role = new cdk.aws_iam.Role(input.scope, `${input.id_prefix}execution-role`, {
        assumedBy: new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        inlinePolicies: {
            [`${input.id_prefix}-execution-policy`]: new cdk.aws_iam.PolicyDocument({
                statements: [
                    new cdk.aws_iam.PolicyStatement({
                        sid: 'PullDockerImage',
                        effect: cdk.aws_iam.Effect.ALLOW,
                        actions: [
                            "ecr:GetAuthorizationToken",
                            "ecr:BatchCheckLayerAvailability",
                            "ecr:GetDownloadUrlForLayer",
                            "ecr:BatchGetImage",
                        ],
                        resources: ['*'],
                    }),
                    new cdk.aws_iam.PolicyStatement({
                        sid: 'ReadSecrets',
                        effect: cdk.aws_iam.Effect.ALLOW,
                        actions: [
                            "secretsmanager:GetSecretValue",
                        ],
                        resources: [encryption_key.secretArn],
                    }),
                ],
            }),
        }
    });

    const task_role = new cdk.aws_iam.Role(input.scope, `${input.id_prefix}task-role`, {
        assumedBy: new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        inlinePolicies: {
            [`${input.id_prefix}-task-policy`]: new cdk.aws_iam.PolicyDocument({
                statements: [
                    new cdk.aws_iam.PolicyStatement({
                        sid: 'SendPasswordResetEmail',
                        effect: cdk.aws_iam.Effect.ALLOW,
                        actions: [
                            "ses:SendEmail",
                        ],
                        resources: ['arn:aws:ses:${AWS::Region}:${AWS::AccountId}:identity/${EmailIdentity}'],
                        conditions: {
                            'StringEquals': {
                                'ses:FromAddress': `noreply@${input.domain_name}`,
                            },
                        },
                    }),
                ],
            }),
        },
    });

    const task_definition = new cdk.aws_ecs.Ec2TaskDefinition(input.scope, `${input.id_prefix}task-definition`, {
        executionRole: execution_role,
        taskRole: task_role,
    });
    task_definition.addContainer(`${input.id_prefix}container`, {
        image: input.container_image,
        essential: true,
        enableRestartPolicy: true,
        memoryLimitMiB: 512,
        portMappings: [{ containerPort: 9000 }],
        environment: {
            'COOKIE_DOMAIN': env_string_or_throw('COOKIE_DOMAIN'),
            'SERVER_ADDR': ':9000',
            'FILE_EVENT_LOG_FOLDER_PATH': '/opt/eventlog',
            'MAILER_IMPLEMENTATION': 'ses',
            'MAILER_SES_FROM': `BeddyBytes <noreply@${input.domain_name}>`,
            'MAILER_SES_APP_HOST': host_names.app,
            'AWS_REGION': process.env.AWS_REGION || '',
            'MQTT_IMPLEMENTATION': 'aws_iot',
            'MQTT_BROKER': env_string_or_throw('MQTT_BROKER'),
            'MQTT_AWS_IOT_ROOT_CA_FILE': 'AmazonRootCA1.pem',
            'MQTT_AWS_IOT_CERT_FILE': 'certificate.crt',
            'MQTT_AWS_IOT_KEY_FILE': 'private_key.pem',
        },
        secrets: {
            'ENCRYPTION_KEY': cdk.aws_ecs.Secret.fromSecretsManager(encryption_key),
        },
        dockerLabels: {
            'traefik.enable': 'true',

            [`traefik.http.routers.${input.traefik_prefix}anonymous-token.rule`]: `"Host(\`${host_name}\`) && Path(\`/anonymous_token\`) && Method(\`POST\`)"`,
            [`traefik.http.routers.${input.traefik_prefix}anonymous-token.entrypoints`]: "websecure",
            [`traefik.http.routers.${input.traefik_prefix}anonymous-token.tls`]: "true",
            [`traefik.http.routers.${input.traefik_prefix}anonymous-token.tls.certresolver`]: "letsencrypt",
            [`traefik.http.routers.${input.traefik_prefix}anonymous-token.middlewares`]: "headers-cors@file,rate-limit-anonymous-token@file",

            [`traefik.http.routers.${input.traefik_prefix}create-account.rule`]: `"Host(\`${host_name}\`) && Path(\`/accounts\`) && Method(\`POST\`)"`,
            [`traefik.http.routers.${input.traefik_prefix}create-account.entrypoints`]: "websecure",
            [`traefik.http.routers.${input.traefik_prefix}create-account.tls`]: "true",
            [`traefik.http.routers.${input.traefik_prefix}create-account.tls.certresolver`]: "letsencrypt",
            [`traefik.http.routers.${input.traefik_prefix}create-account.middlewares`]: "headers-cors@file,rate-limit-create-account@file",

            [`traefik.http.routers.${input.traefik_prefix}api.rule`]: `"Host(\`${host_name}\`)"`,
            [`traefik.http.routers.${input.traefik_prefix}api.entrypoints`]: "websecure",
            [`traefik.http.routers.${input.traefik_prefix}api.tls`]: "true",
            [`traefik.http.routers.${input.traefik_prefix}api.tls.certresolver`]: "letsencrypt",
            [`traefik.http.routers.${input.traefik_prefix}api.middlewares`]: "headers-cors@file,rate-limit-api@file",
        },
    });

    const service = new cdk.aws_ecs.Ec2Service(input.scope, `${input.id_prefix}service`, {
        cluster: input.cluster,
        taskDefinition: task_definition,
        desiredCount: 1,
        minHealthyPercent: 0,
        maxHealthyPercent: 100,
    });

    const dns_record = new cdk.aws_route53.ARecord(input.scope, `${input.id_prefix}alias`, {
        zone: input.hosted_zone,
        recordName: host_name,
        ttl: cdk.Duration.minutes(15),
        target: cdk.aws_route53.RecordTarget.fromIpAddresses(input.elastic_ip.ref as string),
    });
    
    create_thing({
        scope: input.scope,
        id_prefix: input.id_prefix,
    });
}

interface CreateThingInput {
    scope: Construct;
    id_prefix: string;
}

export const create_thing = (input: CreateThingInput) => {
    const thing = new cdk.aws_iot.CfnThing(input.scope, `${input.id_prefix}thing`, {
        thingName: `${input.id_prefix}-thing`,
    });

    const certificate = new cdk.aws_iot.CfnCertificate(input.scope, `${input.id_prefix}thing-certificate`, {
        status: 'ACTIVE',
        certificateMode: 'DEFAULT',
        certificateSigningRequest: "", // TODO
    });

    const principal_attachment = new cdk.aws_iot.CfnThingPrincipalAttachment(input.scope, `${input.id_prefix}thing-principal-attachment`, {
        principal: certificate.attrArn,
        thingName: thing.attrId,
    });

    const policy = new cdk.aws_iot.CfnPolicy(input.scope, `${input.id_prefix}thing-policy`, {
        policyName: `${input.id_prefix}-thing-policy`,
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

    const policy_attachment = new cdk.aws_iot.CfnPolicyPrincipalAttachment(input.scope, `${input.id_prefix}thing-policy-attachment`, {
        policyName: policy.attrId,
        principal: certificate.attrArn,
    });
}