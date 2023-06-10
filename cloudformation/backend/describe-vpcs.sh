#!/bin/bash
. init.sh
set -ex

aws ec2 describe-vpcs \
    --region ap-southeast-2 \
    --filters "Name=is-default,Values=true"