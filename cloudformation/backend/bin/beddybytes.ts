#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { CoreStack } from '../lib/CoreStack';
import { SecretsStack } from '../lib/SecretsStack';
import { EmailStack } from '../lib/EmailStack';
import { ContinuousIntegrationStack } from '../lib/ContinuousIntegrationStack';
import { LoadBalancerStack } from '../lib/LoadBalancerStack';
import { MonitoringStack } from '../lib/MonitoringStack';
import { BackendStack } from '../lib/BackendStack';

// TODO remove dev host names from traefik/letsencrypt/acme.json and take a new snapshot

const app = new cdk.App();

const core_stack = new CoreStack(app, 'beddybytes-core');

const secrets_stack = new SecretsStack(app, 'beddybytes-secrets');

const monitoring_stack = new MonitoringStack(app, 'beddybytes-monitoring', {
  cluster: core_stack.cluster,
  elastic_ip: core_stack.elastic_ip,
});

const load_balancer_stack = new LoadBalancerStack(app, 'beddybytes-load-balancer', {
  cluster: core_stack.cluster,
  influxdb_container: monitoring_stack.influxdb_container,
});

const ci_stack = new ContinuousIntegrationStack(app, 'beddybytes-ci');

new BackendStack(app, 'beddybytes-backend-prod', {
  deploy_env: 'prod',
  docker_repository: ci_stack.docker_repository,
  docker_image_digest: 'sha256:99274c7e364c3a4716f18cf85ae690a606b0ddec34628620b0c6d5252d629736',
  cluster: core_stack.cluster,
  signing_key: secrets_stack.signing_key,
  elastic_ip: core_stack.elastic_ip,
});

new BackendStack(app, 'beddybytes-backend-qa', {
  deploy_env: 'qa',
  docker_repository: ci_stack.docker_repository,
  docker_image_digest: 'sha256:99274c7e364c3a4716f18cf85ae690a606b0ddec34628620b0c6d5252d629736',
  cluster: core_stack.cluster,
  signing_key: secrets_stack.signing_key,
  elastic_ip: core_stack.elastic_ip,
});

new EmailStack(app, 'beddybytes-email');
