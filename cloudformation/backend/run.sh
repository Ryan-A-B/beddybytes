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