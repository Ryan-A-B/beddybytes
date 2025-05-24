import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface StackProps extends cdk.StackProps {
    cluster: cdk.aws_ecs.ICluster;
    influxdb_container: cdk.aws_ecs.ContainerDefinition;
}

export class LoadBalancerStack extends cdk.Stack {
    constructor(scope: Construct, id_prefix: string, props: StackProps) {
        super(scope, id_prefix, props);

        const execution_role = new cdk.aws_iam.Role(this, `execution-role`, {
            assumedBy: new cdk.aws_iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
        });

        const task_role = new cdk.aws_iam.Role(this, `task-role`, {
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
                    ],
                }),
            },
        });

        const task_definition = new cdk.aws_ecs.Ec2TaskDefinition(this, `task-definition`, {
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
            ],
        });

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

        const service = new cdk.aws_ecs.Ec2Service(this, `service`, {
            cluster: props.cluster,
            taskDefinition: task_definition,
            desiredCount: 1,
            minHealthyPercent: 0,
            maxHealthyPercent: 100,
        });
    }
}