#!/bin/bash
. init.sh
set -ex

region=us-east-1
stack_name=beddybytes-marketing

aws cloudformation update-stack \
    --region $region \
    --stack-name $stack_name \
    --template-body file://cloudformation.yml \
    --parameters file://parameters.json

aws cloudformation wait stack-update-complete \
    --region $region \
    --stack-name $stack_name