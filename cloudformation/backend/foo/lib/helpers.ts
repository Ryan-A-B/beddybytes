import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export const override_logical_id = (resource: Construct, logical_id: string) => {
    const cfn_resource = to_cfn_resource(resource);
    cfn_resource.overrideLogicalId(logical_id);
}

const to_cfn_resource = (resource: Construct): cdk.CfnResource => {
    if (resource instanceof cdk.CfnResource) return resource;
    const cfn_resource = resource.node.defaultChild as cdk.CfnResource;
    if (cfn_resource === undefined) throw new Error('Resource does not have a default child');
    return cfn_resource;
}