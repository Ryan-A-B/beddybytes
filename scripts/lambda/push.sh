#!/bin/bash -e

source ./scripts/lambda/init.sh

set -x

aws s3 cp iot-authorizer.zip "s3://$BUCKET"