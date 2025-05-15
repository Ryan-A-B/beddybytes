#!/bin/bash
. init.sh
set -ex

usage="Usage: $0 <create|update|delete>"

case $1 in
    create|update|delete)
        action=$1
        ;;
    *)
        echo $usage
        exit 1
        ;;
esac

region=us-east-1
stack_name="beddybytes-backend"

function upload_to_s3() {
    local file_path=$1
    local s3_bucket="beddybytes-backend-bucket"
    local s3_key="cloudformation/backend/$file_path"

    if [[ -z "$file_path" || -z "$s3_key" ]]; then
        echo "Usage: upload_to_s3 <file_path> <s3_key>"
        exit 1
    fi

    aws s3 cp "$file_path" "s3://$s3_bucket/$s3_key"
    if [[ $? -ne 0 ]]; then
        echo "Failed to upload $file_path to s3://$s3_bucket/$s3_key"
        exit 1
    fi
}

# upload_to_s3 "api.cloudformation.yml"

case $action in
    create|update)
        parameters_file="parameters.json"
        aws cloudformation $action-stack \
            --region $region \
            --stack-name $stack_name \
            --template-body file://cloudformation.yml \
            --parameters file://$parameters_file \
            --capabilities CAPABILITY_IAM
        ;;
    delete)
        aws cloudformation delete-stack \
            --region $region \
            --stack-name $stack_name
        ;;
    *)
        echo "Unexpected action: $action"
        exit 1
        ;;
esac

aws cloudformation wait stack-$action-complete \
    --region $region \
    --stack-name $stack_name