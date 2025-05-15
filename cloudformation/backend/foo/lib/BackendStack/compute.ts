import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AddNetworkingOutput } from './networking';
import { override_logical_id } from '../helpers';
import { DeployEnv } from '../config';

const instance_type = cdk.aws_ec2.InstanceType.of(
    cdk.aws_ec2.InstanceClass.BURSTABLE4_GRAVITON,
    cdk.aws_ec2.InstanceSize.SMALL,
);

interface AddComputeInput {
    scope: Construct;
    id_prefix: string;
    deploy_env: DeployEnv
    snapshot_id: string;
    networking: AddNetworkingOutput;
}

interface AddComputeOutput {
    cluster: cdk.aws_ecs.ICluster;
}

export const add_compute = (input: AddComputeInput): AddComputeOutput => {
    const cluster_name = `${input.id_prefix}-cluster`;

    const instance_profile_role = add_instance_profile_role({
        scope: input.scope,
    });
    override_logical_id(instance_profile_role, "InstanceProfileRole");

    const persistent_volume = new cdk.aws_ec2.Volume(input.scope, "persistent-volume", {
        availabilityZone: input.networking.availability_zone,
        volumeType: cdk.aws_ec2.EbsDeviceVolumeType.GP3,
        snapshotId: input.snapshot_id,
        removalPolicy: input.deploy_env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });
    override_logical_id(persistent_volume, "PersistentVolume");

    const key_pair = new cdk.aws_ec2.KeyPair(input.scope, "key-pair", {
        keyPairName: `${input.id_prefix}-key-pair`,
        publicKeyMaterial: process.env.PUBLIC_KEY_MATERIAL!,
    });
    override_logical_id(key_pair, "KeyPair");

    const launch_template = new cdk.aws_ec2.LaunchTemplate(input.scope, `launch-template`, {
        launchTemplateName: `${input.id_prefix}-launch-template`,
        machineImage: cdk.aws_ec2.MachineImage.fromSsmParameter(
            // TODO migrate to amazon-linux-2
            '/aws/service/ecs/optimized-ami/amazon-linux-2023/arm64/recommended/image_id',
        ),
        instanceType: instance_type,
        keyPair: key_pair,
        securityGroup: input.networking.api_security_group,
        userData: create_user_data({
            persistent_volume_id: persistent_volume.volumeId,
            backend_cluster_name: cluster_name,
            public_ip: input.networking.elastic_ip.attrPublicIp,
        }),
        role: instance_profile_role,
    });
    launch_template.addSecurityGroup(input.networking.ssh_security_group);
    override_logical_id(launch_template, "ECSInstanceLaunchTemplate");

    const auto_scaling_group = new cdk.aws_autoscaling.AutoScalingGroup(input.scope, `auto-scaling-group`, {
        vpc: input.networking.vpc,
        launchTemplate: launch_template,
        minCapacity: 0,
        maxCapacity: 1,
        desiredCapacity: 1,
        healthChecks: cdk.aws_autoscaling.HealthChecks.withAdditionalChecks({
            additionalTypes: [cdk.aws_autoscaling.AdditionalHealthCheckType.EBS],
        }),
    });
    override_logical_id(auto_scaling_group, "ECSInstanceAutoScalingGroup");

    const cluster = new cdk.aws_ecs.Cluster(input.scope, `cluster`, {
        vpc: input.networking.vpc,
        clusterName: cluster_name,
    });
    override_logical_id(cluster, "BackendCluster");
    cluster.addAsgCapacityProvider(new cdk.aws_ecs.AsgCapacityProvider(input.scope, `cluster-asg-capacity-provider`, {
        autoScalingGroup: auto_scaling_group,
    }));

    return {
        cluster,
    };
};

interface AddInstanceProfileRoleInput {
    scope: Construct;
}

const add_instance_profile_role = (input: AddInstanceProfileRoleInput): cdk.aws_iam.Role => {
    return new cdk.aws_iam.Role(input.scope, `instance-profile-role`, {
        assumedBy: new cdk.aws_iam.ServicePrincipal('ec2.amazonaws.com'),
        managedPolicies: [
            cdk.aws_iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonEC2ContainerServiceforEC2Role')
        ],
        inlinePolicies: {
            EC2AddressAssociation: new cdk.aws_iam.PolicyDocument({
                statements: [
                    new cdk.aws_iam.PolicyStatement({
                        effect: cdk.aws_iam.Effect.ALLOW,
                        actions: ['ec2:AssociateAddress'],
                        resources: ['*'],
                    }),
                ],
            }),
            EC2VolumeAttachment: new cdk.aws_iam.PolicyDocument({
                statements: [
                    new cdk.aws_iam.PolicyStatement({
                        effect: cdk.aws_iam.Effect.ALLOW,
                        actions: ['ec2:AttachVolume'],
                        resources: ['*'],
                    }),
                ],
            }),
            ECRPush: new cdk.aws_iam.PolicyDocument({
                statements: [
                    new cdk.aws_iam.PolicyStatement({
                        effect: cdk.aws_iam.Effect.ALLOW,
                        actions: [
                            'ecr:GetAuthorizationToken',
                            'ecr:BatchCheckLayerAvailability',
                            'ecr:InitiateLayerUpload',
                            'ecr:UploadLayerPart',
                            'ecr:CompleteLayerUpload',
                            'ecr:PutImage',
                        ],
                        resources: ['*'],
                    }),
                ],
            }),
        },
    });
}

interface CreateUserDataInput {
    persistent_volume_id: string;
    backend_cluster_name: string;
    public_ip: string;
}

const create_user_data = (input: CreateUserDataInput): cdk.aws_ec2.UserData => {
    const user_data = cdk.aws_ec2.UserData.forLinux();
    user_data.addCommands(
        `#!/bin/bash -ex`,
        `handle_error() { shutdown -h now; }`,
        `trap 'handle_error' ERR`,
        `TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 10")`,
        `INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)`,
        `aws ec2 attach-volume --volume-id ${input.persistent_volume_id} --instance-id $INSTANCE_ID --device /dev/xvdf`,
        `while [ ! -e /dev/nvme1n1 ]; do sleep 1; done`,
        `mkdir -p /ebs/persistent`,
        `mount /dev/nvme1n1 /ebs/persistent`,
        `cp -R /ebs/persistent/grafana/ /opt/grafana`,
        `chown -R 472:472 /opt/grafana`,
        `cp -R /ebs/persistent/influxdb /opt/influxdb`,
        `echo ECS_CLUSTER=${input.backend_cluster_name} >> /etc/ecs/ecs.config`,
        `aws ec2 associate-address --public-ip ${input.public_ip} --instance-id $INSTANCE_ID`
    );
    return user_data;
}

