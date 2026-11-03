#/bin/bash -ex

aws_region=us-east-1
ip_address=54.81.163.246

instance_id=$(aws ec2 describe-instances \
  --region $aws_region \
  --filters \
    "Name=ip-address,Values=$ip_address" \
    "Name=instance-state-name,Values=running" \
  --query 'Reservations[].Instances[].InstanceId' \
  --output text
)

if [ -z $instance_id ]; then
	echo "unable to find instance for $ip_address"
	exit 1
fi

aws ssm start-session \
	--region $aws_region \
	--target $instance_id
