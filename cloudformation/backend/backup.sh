#!/bin/bash -ex

# Grafana
sudo cp -R /opt/grafana /ebs/persistent/grafana

# InfluxDB
sudo cp -R /opt/influxdb /ebs/persistent/influxdb