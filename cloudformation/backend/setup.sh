#!/bin/bash
set -ex

# Install Docker
sudo yum install docker -y
sudo service docker start
sudo usermod -a -G docker ec2-user

# Clone the baby-monitor repo
sudo yum install git -y
git clone https://github.com/Ryan-A-B/baby-monitor.git

# Install Go
wget https://go.dev/dl/go1.20.5.linux-arm64.tar.gz
sudo tar -C /usr/local -xzf go1.20.5.linux-arm64.tar.gz
export PATH=$PATH:/usr/local/go/bin

# Run certbot
sudo docker run -it --rm --name certbot \
    --network host \
    -v "/etc/letsencrypt:/etc/letsencrypt" \
    -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
    certbot/certbot certonly --standalone
