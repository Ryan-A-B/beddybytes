#!/bin/bash
set -ex

# Create file system. 
# Only do this once per volume.
sudo mkfs -t xfs /dev/nvme1n1

# Mount the volume
sudo mkdir /eventlog
sudo mount /dev/nvme1n1 /eventlog

# Update /etc/fstab
sudo blkid

## example output
# /dev/nvme1n1: UUID="b734b639-de13-47e6-8690-df700164c55a" BLOCK_SIZE="512" TYPE="xfs"

## fstab entry
UUID=b734b639-de13-47e6-8690-df700164c55a /eventlog xfs defaults,nofail 0 2