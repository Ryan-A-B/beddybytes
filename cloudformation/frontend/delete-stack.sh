#!/bin/bash
. init.sh
set -ex

region=us-east-1
stack_name=baby-monitor-frontend

aws cloudformation delete-stack \
    --region $region \
    --stack-name $stack_name

aws cloudformation wait stack-delete-complete \
    --region $region \
    --stack-name $stack_name