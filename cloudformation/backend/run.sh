#!/bin/bash
set -e

export SERVER_ADDR=:443
export FRONTEND_URL=https://app.babymonitor.creativeilk.com
export ACCOUNT_STORE_IMPLEMENTATION=S3
export ACCOUNT_STORE_BUCKET=baby-monitor-backend-bucket

cd /home/ec2-user/baby-monitor/backend
echo "" | /usr/local/go/bin/go run .