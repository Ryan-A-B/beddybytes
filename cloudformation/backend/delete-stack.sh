#!/bin/bash
. init.sh
set -ex

region=ap-southeast-2
stack_name=baby-monitor-backend

aws cloudformation delete-stack \
    --region $region \
    --stack-name $stack_name

aws cloudformation wait stack-delete-complete \
    --region $region \
    --stack-name $stack_name