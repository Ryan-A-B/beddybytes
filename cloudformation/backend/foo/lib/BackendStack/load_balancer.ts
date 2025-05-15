import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { override_logical_id } from '../helpers';
import { domain_name, HostNames } from '../config';

interface AddLoadBalancerInput {
    id_prefix: string;
    scope: Construct;
    aws_region: string;
    cluster: cdk.aws_ecs.ICluster;
    hosted_zone: cdk.aws_route53.IHostedZone;
    elastic_ip: cdk.aws_ec2.CfnEIP;
    api_container_image: cdk.aws_ecs.ContainerImage;
    host_names: HostNames;
}

export const add_load_balancer = (input: AddLoadBalancerInput) => {
    const influx_admin_password = new cdk.aws_secretsmanager.Secret(input.scope, `influx-admin-password`, {
        secretName: `${input.id_prefix}-influx-password`,
    });
    override_logical_id(influx_admin_password, 'InfluxAdminPassword');
    const grafana_admin_password = new cdk.aws_secretsmanager.Secret(input.scope, `grafana-admin-password`, {
        secretName: `${input.id_prefix}-grafana-password`,
    });
    override_logical_id(grafana_admin_password, 'GrafanaAdminPassword');
    const encryption_key = new cdk.aws_secretsmanager.Secret(input.scope, `encryption-key`, {
        secretName: `${input.id_prefix}-encryption-key`,
    });
    override_logical_id(encryption_key, 'BackendEncryptionKey');

    const execution_role = new cdk.aws_iam.Role(input.scope, `execution-role`, {
        assumedBy: new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    });

    const task_role = new cdk.aws_iam.Role(input.scope, `task-role`, {
        assumedBy: new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        inlinePolicies: {
            [`load-balancer-task-policy`]: new cdk.aws_iam.PolicyDocument({
                statements: [
                    new cdk.aws_iam.PolicyStatement({
                        sid: 'TraefikECSReadAccess',
                        effect: cdk.aws_iam.Effect.ALLOW,
                        actions: [
                            "ecs:ListClusters",
                            "ecs:DescribeClusters",
                            "ecs:ListTasks",
                            "ecs:DescribeTasks",
                            "ecs:DescribeContainerInstances",
                            "ecs:DescribeTaskDefinition",
                            "ec2:DescribeInstances",
                        ],
                        resources: ['*'],
                    }),
                    new cdk.aws_iam.PolicyStatement({
                        sid: 'SendPasswordResetEmail',
                        effect: cdk.aws_iam.Effect.ALLOW,
                        actions: [
                            "ses:SendEmail",
                        ],
                        resources: [`arn:aws:ses:${input.aws_region}:${cdk.Stack.of(input.scope).account}:identity/${domain_name}`],
                        conditions: {
                            'StringEquals': {
                                'ses:FromAddress': `noreply@${domain_name}`,
                            },
                        },
                    }),
                ],
            }),
        },
    });

    const task_definition = new cdk.aws_ecs.Ec2TaskDefinition(input.scope, `load-balancer-task-definition`, {
        executionRole: execution_role,
        taskRole: task_role,
        volumes: [
            {
                name: 'traefik',
                host: {
                    sourcePath: '/ebs/persistent/traefik',
                },
            },
            {
                name: 'traefik-logs',
                host: {
                    sourcePath: '/opt/logs/traefik',
                },
            },
            {
                name: 'grafana',
                host: {
                    sourcePath: '/opt/grafana',
                },
            },
            {
                name: 'influxdb',
                host: {
                    sourcePath: '/opt/influxdb',
                },
            },
            {
                name: 'eventlog',
                host: {
                    sourcePath: '/ebs/persistent/eventlog',
                },
            },
        ],
    });
    override_logical_id(task_definition, 'BackendTaskDefinition');
    const traefik_container = task_definition.addContainer(`traefik`, {
        image: cdk.aws_ecs.ContainerImage.fromRegistry("traefik:3.2"),
        essential: true,
        enableRestartPolicy: true,
        memoryLimitMiB: 256,
        portMappings: [
            {
                containerPort: 80,
                hostPort: 80,
            },
            {
                containerPort: 443,
                hostPort: 443,
            },
        ],
        healthCheck: {
            command: [
                "CMD-SHELL",
                "traefik healthcheck",
            ],
        },
    });
    traefik_container.addMountPoints({
        sourceVolume: 'traefik',
        containerPath: '/etc/traefik',
        readOnly: false,
    });
    traefik_container.addMountPoints({
        sourceVolume: 'traefik-logs',
        containerPath: '/opt/logs',
        readOnly: false,
    });

    // TODO use api.ts instead
    const api_container = task_definition.addContainer(`api`, {
        image: input.api_container_image,
        essential: true,
        enableRestartPolicy: true,
        memoryLimitMiB: 512,
        portMappings: [{ containerPort: 9000 }],
        environment: {
                    'COOKIE_DOMAIN': `.${domain_name}`,
                    'SERVER_ADDR': ':9000',
                    'FILE_EVENT_LOG_FOLDER_PATH': '/opt/eventlog',
                    'MAILER_IMPLEMENTATION': 'ses',
                    'MAILER_SES_FROM': `BeddyBytes <noreply@${domain_name}>`,
                    'MAILER_SES_APP_HOST': input.host_names.app,
                    'AWS_REGION': input.aws_region,
                },
                secrets: {
                    'ENCRYPTION_KEY': cdk.aws_ecs.Secret.fromSecretsManager(encryption_key),
                },
                dockerLabels: {
                    'traefik.enable': 'true',

                    [`traefik.http.routers.anonymous-token.rule`]: `Host(\`${input.host_names.api}\`) && Path(\`/anonymous_token\`) && Method(\`POST\`)`,
                    [`traefik.http.routers.anonymous-token.entrypoints`]: "websecure",
                    [`traefik.http.routers.anonymous-token.tls`]: "true",
                    [`traefik.http.routers.anonymous-token.tls.certresolver`]: "letsencrypt",
                    [`traefik.http.routers.anonymous-token.middlewares`]: "headers-cors@file,rate-limit-anonymous-token@file",

                    [`traefik.http.routers.create-account.rule`]: `Host(\`${input.host_names.api}\`) && Path(\`/accounts\`) && Method(\`POST\`)`,
                    [`traefik.http.routers.create-account.entrypoints`]: "websecure",
                    [`traefik.http.routers.create-account.tls`]: "true",
                    [`traefik.http.routers.create-account.tls.certresolver`]: "letsencrypt",
                    [`traefik.http.routers.create-account.middlewares`]: "headers-cors@file,rate-limit-create-account@file",

                    [`traefik.http.routers.api.rule`]: `Host(\`${input.host_names.api}\`)`,
                    [`traefik.http.routers.api.entrypoints`]: "websecure",
                    [`traefik.http.routers.api.tls`]: "true",
                    [`traefik.http.routers.api.tls.certresolver`]: "letsencrypt",
                    [`traefik.http.routers.api.middlewares`]: "headers-cors@file,rate-limit-api@file",
                },
    });
    api_container.addMountPoints({
        sourceVolume: 'eventlog',
        containerPath: '/opt/eventlog',
        readOnly: false,
    });

    const influxdb_container = task_definition.addContainer(`influxdb`, {
        image: cdk.aws_ecs.ContainerImage.fromRegistry("influxdb:2.7-alpine"),
        essential: false,
        enableRestartPolicy: true,
        memoryLimitMiB: 128,
        portMappings: [{ containerPort: 8086 }],
        healthCheck: {
            command: [
                "CMD-SHELL",
                "curl --fail http://localhost:8086/ping",
            ],
        },
        environment: {
            DOCKER_INFLUXDB_INIT_MODE: "setup",
            DOCKER_INFLUXDB_INIT_USERNAME: "admin",
            DOCKER_INFLUXDB_INIT_ORG: "beddybytes",
            DOCKER_INFLUXDB_INIT_BUCKET: "traefik",
            DOCKER_INFLUXDB_INIT_RETENTION: "3d",
        },
        secrets: {
            DOCKER_INFLUXDB_INIT_PASSWORD: cdk.aws_ecs.Secret.fromSecretsManager(influx_admin_password),
        },
        dockerLabels: {
            'traefik.enable': 'true',
            'traefik.http.routers.influxdb.rule': `Host(\`${input.host_names.influxdb}\`)`,
            'traefik.http.routers.influxdb.entrypoints': 'websecure',
            'traefik.http.routers.influxdb.tls': 'true',
            'traefik.http.routers.influxdb.tls.certresolver': 'letsencrypt',
        },
    });
    influxdb_container.addMountPoints({
        sourceVolume: 'influxdb',
        containerPath: '/var/lib/influxdb2',
        readOnly: false,
    });

    const grafana_container = task_definition.addContainer(`grafana`, {
        image: cdk.aws_ecs.ContainerImage.fromRegistry("grafana/grafana-oss:11.4.0"),
        essential: false,
        enableRestartPolicy: true,
        memoryLimitMiB: 128,
        portMappings: [{ containerPort: 3000 }],
        healthCheck: {
            command: [
                "CMD-SHELL",
                "curl --fail http://localhost:3000/api/health",
            ],
        },
        secrets: {
            GF_SECURITY_ADMIN_PASSWORD: cdk.aws_ecs.Secret.fromSecretsManager(grafana_admin_password),
        },
        dockerLabels: {
            'traefik.enable': 'true',
            'traefik.http.routers.grafana.rule': `Host(\`${input.host_names.grafana}\`)`,
            'traefik.http.routers.grafana.entrypoints': 'websecure',
            'traefik.http.routers.grafana.tls': 'true',
            'traefik.http.routers.grafana.tls.certresolver': 'letsencrypt',
        },
    });
    grafana_container.addMountPoints({
        sourceVolume: 'grafana',
        containerPath: '/var/lib/grafana',
        readOnly: false,
    });
    
    traefik_container.addLink(influxdb_container, 'influxdb');
    grafana_container.addLink(influxdb_container, 'influxdb');

    const service = new cdk.aws_ecs.Ec2Service(input.scope, `service`, {
        cluster: input.cluster,
        taskDefinition: task_definition,
        desiredCount: 1,
        minHealthyPercent: 0,
        maxHealthyPercent: 100,
    });
    override_logical_id(service, 'BackendService');
}