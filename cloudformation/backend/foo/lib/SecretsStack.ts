import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class SecretsStack extends cdk.Stack {
    public readonly signing_key: cdk.aws_secretsmanager.ISecret;

    constructor(scope: Construct, id_prefix: string, props?: cdk.StackProps) {
        super(scope, id_prefix, props);

        this.signing_key = new cdk.aws_secretsmanager.Secret(this, `signing-key`, {
            secretName: `${id_prefix}-signing-key`,
        });
    }
}