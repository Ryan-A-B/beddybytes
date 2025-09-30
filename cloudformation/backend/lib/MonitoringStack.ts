import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { domain_name, env_hosted_zone_or_throw, HostNames } from './config';

const influxdb_hostname = `influxdb.${domain_name}`;
const grafana_hostname = `grafana.${domain_name}`;

interface StackProps extends cdk.StackProps {
    elastic_ip: cdk.aws_ec2.CfnEIP;
    cluster: cdk.aws_ecs.ICluster;
}

export class MonitoringStack extends cdk.Stack {
    public readonly influxdb_container: cdk.aws_ecs.ContainerDefinition;
    public readonly grafana_container: cdk.aws_ecs.ContainerDefinition;

    constructor(scope: Construct, id_prefix: string, props: StackProps) {
        super(scope, id_prefix, props);

        const hosted_zone = env_hosted_zone_or_throw(this);

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
            ],
        });

        this.influxdb_container = task_definition.addContainer(`influxdb`, {
            containerName: 'influxdb',
            image: cdk.aws_ecs.ContainerImage.fromRegistry("influxdb:2.7-alpine"),
            essential: true,
            enableRestartPolicy: true,
            memoryLimitMiB: 256,
            portMappings: [{ containerPort: 8086 }],
            healthCheck: {
                command: [
                    "CMD-SHELL",
                    "curl --fail http://localhost:8086/ping",
                ],
            },
            dockerLabels: {
                'traefik.enable': 'true',
                'traefik.http.routers.influxdb.rule': `Host(\`${influxdb_hostname}\`)`,
                'traefik.http.routers.influxdb.entrypoints': 'websecure',
                'traefik.http.routers.influxdb.tls': 'true',
                'traefik.http.routers.influxdb.tls.certresolver': 'letsencrypt',
            },
        });
        this.influxdb_container.addMountPoints({
            sourceVolume: 'influxdb',
            containerPath: '/var/lib/influxdb2',
            readOnly: false,
        });

        this.grafana_container = task_definition.addContainer(`grafana`, {
            image: cdk.aws_ecs.ContainerImage.fromRegistry("grafana/grafana-oss:11.4.0"),
            essential: false,
            enableRestartPolicy: true,
            memoryLimitMiB: 256,
            portMappings: [{ containerPort: 3000 }],
            healthCheck: {
                command: [
                    "CMD-SHELL",
                    "curl --fail http://localhost:3000/api/health",
                ],
            },
            dockerLabels: {
                'traefik.enable': 'true',
                'traefik.http.routers.grafana.rule': `Host(\`${grafana_hostname}\`)`,
                'traefik.http.routers.grafana.entrypoints': 'websecure',
                'traefik.http.routers.grafana.tls': 'true',
                'traefik.http.routers.grafana.tls.certresolver': 'letsencrypt',
            },
        });
        this.grafana_container.addMountPoints({
            sourceVolume: 'grafana',
            containerPath: '/var/lib/grafana',
            readOnly: false,
        });
        this.grafana_container.addLink(this.influxdb_container, 'influxdb');

        const service = new cdk.aws_ecs.Ec2Service(this, `service`, {
            cluster: props.cluster,
            taskDefinition: task_definition,
            desiredCount: 1,
            minHealthyPercent: 0,
            maxHealthyPercent: 100,
        });

        const influx_dns_record = new cdk.aws_route53.ARecord(this, `influxdb-dns`, {
            zone: hosted_zone,
            recordName: influxdb_hostname,
            ttl: cdk.Duration.minutes(15),
            target: cdk.aws_route53.RecordTarget.fromIpAddresses(props.elastic_ip.ref as string),
        });

        const grafana_dns_record = new cdk.aws_route53.ARecord(this, `grafana-dns`, {
            zone: hosted_zone,
            recordName: grafana_hostname,
            ttl: cdk.Duration.minutes(15),
            target: cdk.aws_route53.RecordTarget.fromIpAddresses(props.elastic_ip.ref as string),
        });
    }
}
