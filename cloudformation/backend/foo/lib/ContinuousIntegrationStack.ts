import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ContinuousIntegrationStack extends cdk.Stack {
    public readonly docker_repository: cdk.aws_ecr.IRepository;

    constructor(scope: Construct, id_prefix: string, props?: cdk.StackProps) {
        super(scope, id_prefix, props);

        const docker_repository = new cdk.aws_ecr.Repository(this, `${id_prefix}-repository`, {
            repositoryName: 'beddybytes-api',
        });
        this.docker_repository = docker_repository;

        const build_project = new cdk.aws_codebuild.Project(this, `${id_prefix}-build-project`, {
            projectName: 'beddybytes-api-build',
            source: cdk.aws_codebuild.Source.gitHub({
                owner: 'Ryan-A-B',
                repo: 'beddybytes',
            }),
            environment: {
                buildImage: cdk.aws_codebuild.LinuxArmBuildImage.AMAZON_LINUX_2023_STANDARD_3_0,
                privileged: true, // Required for Docker builds
                environmentVariables: {
                    DOCKER_REPOSITORY_URI: {
                        value: docker_repository.repositoryUri,
                    },
                    DOCKER_IMAGE_TAG: {
                        value: 'latest',
                    },
                },
            },
            buildSpec: cdk.aws_codebuild.BuildSpec.fromObject({
                version: '0.2',
                phases: {
                    pre_build: {
                        commands: [
                            'echo Logging in to Amazon ECR...',
                            'aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $DOCKER_REPOSITORY_URI',
                        ],
                    },
                    build: {
                        commands: [
                            'echo Building the Docker image...',
                            'docker build --file scripts/backend/Dockerfile -t $DOCKER_REPOSITORY_URI:$DOCKER_IMAGE_TAG .',
                        ],
                    },
                    post_build: {
                        commands: [
                            'echo Pushing the Docker image...',
                            'docker push $DOCKER_REPOSITORY_URI:$DOCKER_IMAGE_TAG',
                        ],
                    },
                },
            }),
            environmentVariables: {
                AWS_REGION: {
                    value: cdk.Stack.of(this).region,
                },
            },
        });
        docker_repository.grantPullPush(build_project);
    }
}
