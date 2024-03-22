#!/bin/bash
. init.sh
set -ex

region=us-east-1
stack_name=beddybytes-frontend

aws cloudformation create-stack \
    --region $region \
    --stack-name $stack_name \
    --template-body file://cloudformation.yml \
    --parameters file://parameters.json

aws cloudformation wait stack-create-complete \
    --region $region \
    --stack-name $stack_name