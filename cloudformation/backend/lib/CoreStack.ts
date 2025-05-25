import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { env_string_or_throw } from './config';

const vpc_name = 'beddybytes-vpc';
const cluster_name = 'beddybytes-cluster';
const snapshot_id = env_string_or_throw('SNAPSHOT_ID');
const instance_type = cdk.aws_ec2.InstanceType.of(
    cdk.aws_ec2.InstanceClass.BURSTABLE4_GRAVITON,
    cdk.aws_ec2.InstanceSize.SMALL,
);

const my_ip_address = cdk.aws_ec2.Peer.ipv4(env_string_or_throw('MY_IP_ADDRESS'));

export class CoreStack extends cdk.Stack {
    public readonly bucket: cdk.aws_s3.IBucket;
    public readonly vpc: cdk.aws_ec2.IVpc;
    public readonly elastic_ip: cdk.aws_ec2.CfnEIP;
    public readonly cluster: cdk.aws_ecs.ICluster;

    constructor(scope: Construct, id_prefix: string, props?: cdk.StackProps) {
        super(scope, id_prefix, props);

        this.bucket = new cdk.aws_s3.Bucket(this, `bucket`);

        this.vpc = new cdk.aws_ec2.Vpc(this, `vpc`, {
            vpcName: vpc_name,
            ipAddresses: cdk.aws_ec2.IpAddresses.cidr('10.0.0.0/16'),
            enableDnsHostnames: false,
            enableDnsSupport: true,
            maxAzs: 1,
            subnetConfiguration: [{
                name: 'Public',
                subnetType: cdk.aws_ec2.SubnetType.PUBLIC,
                cidrMask: 24,
            }],
        });

        if (this.vpc.publicSubnets === undefined) throw new Error('Public subnets are undefined');
        if (this.vpc.publicSubnets.length === 0) throw new Error('No public subnets found');
        const public_subnet = this.vpc.publicSubnets[0];
        const availability_zone = public_subnet.availabilityZone;

        this.elastic_ip = new cdk.aws_ec2.CfnEIP(this, `elastic-ip`, {
            domain: 'vpc',
        });

        const persistent_volume = new cdk.aws_ec2.Volume(this, "persistent-volume", {
            availabilityZone: availability_zone,
            volumeType: cdk.aws_ec2.EbsDeviceVolumeType.GP3,
            snapshotId: snapshot_id,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });

        const instance_profile_role = add_instance_profile_role({
            scope: this,
        });
        this.bucket.grantReadWrite(instance_profile_role, "backup/*");

        const api_security_group = new cdk.aws_ec2.SecurityGroup(this, `api_security_group`, {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: 'Security group for the API',
            securityGroupName: 'api_security_group',
        });
        api_security_group.addIngressRule(
            cdk.aws_ec2.Peer.anyIpv4(),
            cdk.aws_ec2.Port.tcp(80),
            'Allow HTTP traffic from anywhere',
        );
        api_security_group.addIngressRule(
            cdk.aws_ec2.Peer.anyIpv4(),
            cdk.aws_ec2.Port.tcp(443),
            'Allow HTTPS traffic from anywhere',
        );

        const ssh_security_group = new cdk.aws_ec2.SecurityGroup(this, `ssh_security_group`, {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: 'Security group for SSH',
            securityGroupName: 'ssh_security_group',
        });
        ssh_security_group.addIngressRule(
            my_ip_address,
            cdk.aws_ec2.Port.tcp(22),
            'Allow SSH traffic from IP address',
        );

        const key_pair = new cdk.aws_ec2.KeyPair(this, "key-pair", {
            keyPairName: `${id_prefix}-key-pair`,
            publicKeyMaterial: process.env.PUBLIC_KEY_MATERIAL!,
        });

        const launch_template = new cdk.aws_ec2.LaunchTemplate(this, `launch-template`, {
            launchTemplateName: `${id_prefix}-launch-template`,
            machineImage: cdk.aws_ec2.MachineImage.fromSsmParameter(
                // TODO migrate to amazon-linux-2
                '/aws/service/ecs/optimized-ami/amazon-linux-2023/arm64/recommended/image_id',
            ),
            instanceType: instance_type,
            keyPair: key_pair,
            securityGroup: api_security_group,
            userData: create_user_data({
                persistent_volume_id: persistent_volume.volumeId,
                backend_cluster_name: cluster_name,
                public_ip: this.elastic_ip.attrPublicIp,
            }),
            role: instance_profile_role,
        });
        launch_template.addSecurityGroup(ssh_security_group);

        const auto_scaling_group = new cdk.aws_autoscaling.AutoScalingGroup(this, `auto-scaling-group`, {
            vpc: this.vpc,
            launchTemplate: launch_template,
            minCapacity: 0,
            maxCapacity: 1,
            desiredCapacity: 1,
            healthChecks: cdk.aws_autoscaling.HealthChecks.withAdditionalChecks({
                additionalTypes: [cdk.aws_autoscaling.AdditionalHealthCheckType.EBS],
            }),
        });

        const cluster = new cdk.aws_ecs.Cluster(this, `cluster`, {
            clusterName: cluster_name,
            vpc: this.vpc,
        });
        this.cluster = cluster;

        const auto_scaling_group_capacity_provider = new cdk.aws_ecs.AsgCapacityProvider(this, `auto-scaling-group-capacity-provider`, {
            autoScalingGroup: auto_scaling_group,
        });
        cluster.addAsgCapacityProvider(auto_scaling_group_capacity_provider);
    }
}

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