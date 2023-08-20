#!/bin/bash
. init.sh
set -ex

aws cloudformation validate-template \
    --region ap-southeast-2 \
    --template-body file://cloudformation.yml