#!/bin/bash
. init.sh
set -ex

region=us-east-1

aws cloudformation validate-template \
    --region $region \
    --template-body file://cloudformation.yml