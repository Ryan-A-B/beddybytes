import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { override_logical_id } from '../helpers';
import { HostNames } from '../config';

interface AddNetworkingInput {
    scope: Construct;
    id_prefix: string;
    hosted_zone: cdk.aws_route53.IHostedZone;
    host_names: HostNames;
    ssh_ip_address: cdk.aws_ec2.IPeer;
}

export interface AddNetworkingOutput {
    vpc: cdk.aws_ec2.Vpc;
    availability_zone: string;
    api_security_group: cdk.aws_ec2.SecurityGroup;
    ssh_security_group: cdk.aws_ec2.SecurityGroup;
    elastic_ip: cdk.aws_ec2.CfnEIP;
}

export const add_networking = (input: AddNetworkingInput): AddNetworkingOutput => {
    const vpc = new cdk.aws_ec2.Vpc(input.scope, `vpc`, {
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
    override_logical_id(vpc, "BackendVPC");

    if (vpc.publicSubnets === undefined) throw new Error('Public subnets are undefined');
    if (vpc.publicSubnets.length === 0) throw new Error('No public subnets found');

    const public_subnet = vpc.publicSubnets[0];
    override_logical_id(public_subnet, "PublicSubnet");

    const availability_zone = vpc.publicSubnets[0].availabilityZone;

    const api_security_group = new cdk.aws_ec2.SecurityGroup(input.scope, `api_security_group`, {
        vpc: vpc,
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
    override_logical_id(api_security_group, "APISecurityGroup");

    const ssh_security_group = new cdk.aws_ec2.SecurityGroup(input.scope, `ssh_security_group`, {
        vpc: vpc,
        allowAllOutbound: true,
        description: 'Security group for SSH',
        securityGroupName: 'ssh_security_group',
    });
    ssh_security_group.addIngressRule(
        input.ssh_ip_address,
        cdk.aws_ec2.Port.tcp(22),
        'Allow SSH traffic from IP address',
    );
    override_logical_id(ssh_security_group, "SSHSecurityGroup");

    const elastic_ip = new cdk.aws_ec2.CfnEIP(input.scope, `elastic-ip`, {
        domain: 'vpc',
    });
    override_logical_id(elastic_ip, "ElasticIP");

    const api_dns_record = new cdk.aws_route53.ARecord(input.scope, `api-dns`, {
        zone: input.hosted_zone,
        recordName: input.host_names.api,
        ttl: cdk.Duration.minutes(15),
        target: cdk.aws_route53.RecordTarget.fromIpAddresses(elastic_ip.ref as string),
    });
    override_logical_id(api_dns_record, 'APIDNSRecord');

    const influx_dns_record = new cdk.aws_route53.ARecord(input.scope, `influxdb-dns`, {
        zone: input.hosted_zone,
        recordName: input.host_names.influxdb,
        ttl: cdk.Duration.minutes(15),
        target: cdk.aws_route53.RecordTarget.fromIpAddresses(elastic_ip.ref as string),
    });
    override_logical_id(influx_dns_record, 'InfluxDNSRecord');

    const grafana_dns_record = new cdk.aws_route53.ARecord(input.scope, `grafana-dns`, {
        zone: input.hosted_zone,
        recordName: input.host_names.grafana,
        ttl: cdk.Duration.minutes(15),
        target: cdk.aws_route53.RecordTarget.fromIpAddresses(elastic_ip.ref as string),
    });
    override_logical_id(grafana_dns_record, 'GrafanaDNSRecord');

    return {
        vpc,
        availability_zone,
        api_security_group,
        ssh_security_group,
        elastic_ip,
    };
}

