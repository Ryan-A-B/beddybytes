#!/bin/bash
set -ex

# Clone the beddybytes repo
git clone https://github.com/Ryan-A-B/beddybytes.git

# Install Docker
# https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository
sudo apt-get update
sudo apt-get install ca-certificates curl gnupg

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update

sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo groupadd docker
sudo usermod -aG docker $USER

sudo snap install aws-cli --classic

# crontab -e
# */10 * * * * cd /home/ubuntu/beddybytes && ./scripts/backend/backup.sh

# create .env with environment variables
# update traefik/traefik.prod.yml with email for letsencrypt
# copy eventlog from backup