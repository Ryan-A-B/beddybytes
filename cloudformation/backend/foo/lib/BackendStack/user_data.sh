#!/bin/bash -ex

handle_error() {
    shutdown -h now
}

trap 'handle_error' ERR

# Get the instance ID
TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 10")
INSTANCE_ID=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" http://169.254.169.254/latest/meta-data/instance-id)

# Attach the EBS volume
aws ec2 attach-volume --volume-id ${PersistentVolume} --instance-id $INSTANCE_ID --device /dev/xvdf
while [ ! -e /dev/nvme1n1 ]; do sleep 1; done
mkdir -p /ebs/persistent
mount /dev/nvme1n1 /ebs/persistent

# Create the grafana data directory
cp -R /ebs/persistent/grafana/ /opt/grafana
chown -R 472:472 /opt/grafana

# Create the influxdb data directory
cp -R /ebs/persistent/influxdb /opt/influxdb

# Associate the ECS instance with the cluster
echo ECS_CLUSTER=${BackendCluster} >> /etc/ecs/ecs.config

# Associate the instance with the Elastic IP address
aws ec2 associate-address --public-ip ${ElasticIP} --instance-id $INSTANCE_ID