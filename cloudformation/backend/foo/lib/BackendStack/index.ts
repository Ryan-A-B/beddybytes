import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeployEnv, domain_name, env_hosted_zone_or_throw, env_string_or_throw, get_host_names } from '../config';
import { add_networking } from './networking';
import { add_compute } from './compute';
import { add_load_balancer } from './load_balancer';
import { override_logical_id } from '../helpers';

interface BackendStackProps extends cdk.StackProps {
    deploy_env: DeployEnv;
}

export class BackendStack extends cdk.Stack {
    constructor(scope: Construct, id_prefix: string, props: BackendStackProps) {
        super(scope, id_prefix, props);

        const my_ip_address = env_string_or_throw('MY_IP_ADDRESS');
        const hosted_zone = env_hosted_zone_or_throw(this);
        const host_names = get_host_names(domain_name, props.deploy_env);

        const networking = add_networking({
            scope: this,
            id_prefix: id_prefix,
            hosted_zone,
            host_names,
            ssh_ip_address: cdk.aws_ec2.Peer.ipv4(my_ip_address),
        });

        const compute = add_compute({
            scope: this,
            id_prefix,
            deploy_env: props.deploy_env,
            snapshot_id: 'snap-06f86f634e255332f',
            networking,
        });

        const api_container_repository = new cdk.aws_ecr.Repository(this, `${id_prefix}-api-container-repository`, {
            repositoryName: `${id_prefix}-api`,
            emptyOnDelete: true,
            removalPolicy: cdk.RemovalPolicy.DESTROY,
        });
        override_logical_id(api_container_repository, "BackendContainerRepository");

        const api_image_digest = env_string_or_throw('API_IMAGE_DIGEST_PROD');

        const load_balancer = add_load_balancer({
            id_prefix,
            scope: this,
            aws_region: cdk.Stack.of(this).region,
            host_names: host_names,
            cluster: compute.cluster,
            hosted_zone: hosted_zone,
            elastic_ip: networking.elastic_ip,
            api_container_image: cdk.aws_ecs.ContainerImage.fromEcrRepository(api_container_repository, "v1"),
        });
    }
}
