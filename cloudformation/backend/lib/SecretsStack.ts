import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DeployEnv } from './config';

export class SecretsStack extends cdk.Stack {
    public readonly signing_key: cdk.aws_secretsmanager.ISecret;
    public readonly backend_bundles: Record<DeployEnv, cdk.aws_secretsmanager.ISecret>;
    public readonly tinyanalytics_token_signing_key: cdk.aws_secretsmanager.ISecret;
    public readonly docker_hub_credentials: cdk.aws_secretsmanager.ISecret;

    constructor(scope: Construct, id_prefix: string, props?: cdk.StackProps) {
        super(scope, id_prefix, props);

        this.signing_key = new cdk.aws_secretsmanager.Secret(this, `signing-key`, {
            secretName: `${id_prefix}-signing-key`,
        });
        // Deployed backends still import this export during the staged migration.
        this.exportValue(this.signing_key.secretArn);

        // Keep the legacy signing key until both environments have migrated.
        const create_bundle = (deploy_env: DeployEnv) => new cdk.aws_secretsmanager.Secret(this, `backend-bundle-${deploy_env}`, {
            secretName: `${id_prefix}-backend-${deploy_env}`,
            description: `BeddyBytes ${deploy_env} backend secrets; populate manually before deploying its backend`,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            // Only empty placeholders enter CloudFormation. Real values are edited in Secrets Manager.
            secretObjectValue: {
                ENCRYPTION_KEY: cdk.SecretValue.unsafePlainText(''),
                GOOGLE_CLIENT_ID: cdk.SecretValue.unsafePlainText(''),
                GOOGLE_CLIENT_SECRET: cdk.SecretValue.unsafePlainText(''),
            },
        });
        this.backend_bundles = {
            qa: create_bundle('qa'),
            prod: create_bundle('prod'),
        };

        this.tinyanalytics_token_signing_key = new cdk.aws_secretsmanager.Secret(this, `tinyanalytics-token-signing-key`, {
            secretName: `${id_prefix}-tinyanalytics-token-signing-key`,
        });
    }
}
