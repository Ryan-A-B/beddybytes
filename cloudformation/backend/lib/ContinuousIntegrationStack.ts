import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class ContinuousIntegrationStack extends cdk.Stack {
    public readonly docker_repository: cdk.aws_ecr.IRepository;
    public readonly tinyanalytics_docker_repository: cdk.aws_ecr.IRepository;

    constructor(scope: Construct, id_prefix: string, props?: cdk.StackProps) {
        super(scope, id_prefix, props);

        const docker_hub_credential = new cdk.aws_secretsmanager.Secret(this, `docker-hub-credentials`);

        // TODO I can't rename the repository without affecting backend-prod
        const docker_repository = new cdk.aws_ecr.Repository(this, `${id_prefix}-repository`, {
            repositoryName: 'beddybytes-api',
        });
        this.docker_repository = docker_repository;

        const tinyanalytics_docker_repository = new cdk.aws_ecr.Repository(this, `${id_prefix}-tinyanalytics-repository`, {
            repositoryName: 'tinyanalytics',
        });
        this.tinyanalytics_docker_repository = tinyanalytics_docker_repository;

        const backend_build_project = this.create_build_project({
            id: 'backend-build-project',
            owner: 'Ryan-A-B',
            repo: 'beddybytes',
            docker_repository,
            docker_hub_credential,
            build_commands: [
                'echo Building the Docker image...',
                'docker build --file scripts/backend/Dockerfile -t $DOCKER_REPOSITORY_URI:$DOCKER_IMAGE_TAG .',
            ],
        });
        docker_repository.grantPullPush(backend_build_project);

        const tinyanalytics_build_project = this.create_build_project({
            id: 'tinyanalytics-build-project',
            owner: 'Ryan-A-B',
            repo: 'tinyanalytics',
            docker_repository: tinyanalytics_docker_repository,
            docker_hub_credential,
            build_commands: [
                'echo Building the Tiny Analytics Docker image...',
                './build.sh "$DOCKER_REPOSITORY_URI:$DOCKER_IMAGE_TAG"',
            ],
        });
        tinyanalytics_docker_repository.grantPullPush(tinyanalytics_build_project);
    }

    private create_build_project(input: {
        id: string;
        owner: string;
        repo: string;
        docker_repository: cdk.aws_ecr.IRepository;
        docker_hub_credential: cdk.aws_secretsmanager.ISecret;
        build_commands: string[];
    }): cdk.aws_codebuild.Project {
        return new cdk.aws_codebuild.Project(this, input.id, {
            source: cdk.aws_codebuild.Source.gitHub({
                owner: input.owner,
                repo: input.repo,
            }),
            environment: {
                buildImage: cdk.aws_codebuild.LinuxArmBuildImage.AMAZON_LINUX_2023_STANDARD_3_0,
                privileged: true, // Required for Docker builds
                computeType: cdk.aws_codebuild.ComputeType.SMALL,
                environmentVariables: {
                    DOCKER_REPOSITORY_URI: {
                        value: input.docker_repository.repositoryUri,
                    },
                    DOCKER_IMAGE_TAG: {
                        value: 'latest',
                    },
                    DOCKER_HUB_USERNAME: {
                        type: cdk.aws_codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
                        value: `${input.docker_hub_credential.secretArn}:username`,
                    },
                    DOCKER_HUB_ACCESS_TOKEN: {
                        type: cdk.aws_codebuild.BuildEnvironmentVariableType.SECRETS_MANAGER,
                        value: `${input.docker_hub_credential.secretArn}:access_token`,
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

                            'echo Logging in to Docker Hub...',
                            'echo $DOCKER_HUB_ACCESS_TOKEN | docker login --username $DOCKER_HUB_USERNAME --password-stdin',
                        ],
                    },
                    build: {
                        commands: input.build_commands,
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
    }
}
