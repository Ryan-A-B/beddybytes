#!/bin/bash
. init.sh
set -ex

aws ec2 describe-subnets \
    --region ap-southeast-2 \
    --filters "[{\"Name\":\"vpc-id\",\"Values\":[\"$1\"]},{\"Name\":\"default-for-az\",\"Values\":[\"true\"]}]"