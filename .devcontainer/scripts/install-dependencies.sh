#!/bin/bash

# Install xdg-utils to enable opening a browser from devcontainer
# Currently no out-of-the box support available see: https://github.com/devcontainers/images/issues/885
sudo apt-get update
sudo apt-get install -y xdg-utils

# Install SAP dependencies
npm install -g @sap/cds-dk typescript ts-node @ui5/cli git-cliff

# Install package.json dependencies
npm install

# Install Cloud Foundry CLI
wget -q -O - https://packages.cloudfoundry.org/debian/cli.cloudfoundry.org.key | sudo apt-key add -
echo "deb https://packages.cloudfoundry.org/debian stable main" | sudo tee /etc/apt/sources.list.d/cloudfoundry-cli.list
sudo apt-get update
sudo apt-get install cf8-cli