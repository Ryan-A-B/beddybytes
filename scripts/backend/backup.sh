#!/bin/bash
set -ex

aws s3 sync eventlog s3://beddybytes-backend-bucket/eventlog