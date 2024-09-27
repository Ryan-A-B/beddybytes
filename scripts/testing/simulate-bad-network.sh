#!/bin/bash
set -ex

NETWORK_INTERFACE=$1

if [ -z "$NETWORK_INTERFACE" ]; then
    echo "Usage: $0 <network-interface>"
    echo "You can find the network interface by running 'ifconfig'"
    exit 1
fi

cleanup() {
    sudo tc qdisc del dev $NETWORK_INTERFACE root
}

trap cleanup EXIT

sudo tc qdisc add dev $NETWORK_INTERFACE root netem loss 100%
# sudo tc qdisc add dev $NETWORK_INTERFACE root netem delay 500ms loss 80%

# Wait for the user to press Ctrl+C
read -r -d '' _ </dev/tty