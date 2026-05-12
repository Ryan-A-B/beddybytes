#!/bin/bash -ex

mkdir -p build/lambda

GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -o build/lambda/bootstrap ./golang/cmd/iot-authorizer

cd build/lambda
python3 -m zipfile -c iot-authorizer.zip bootstrap
rm bootstrap
