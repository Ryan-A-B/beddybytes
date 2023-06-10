#!/bin/bash
. init.sh
set -ex

region=ap-southeast-2
stack_name=baby-monitor-backend

aws cloudformation update-stack \
    --region $region \
    --stack-name $stack_name \
    --template-body file://cloudformation.yml \
    --parameters file://parameters.json

aws cloudformation wait stack-update-complete \
    --region $region \
    --stack-name $stack_name