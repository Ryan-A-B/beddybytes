#!/bin/bash -ex

GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build -tags lambda.norpc -o bootstrap golang/cmd/iot-authorizer/*

zip iot-authorizer.zip bootstrap

rm bootstrap