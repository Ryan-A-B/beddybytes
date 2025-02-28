#!/bin/bash
set -ex

./ensure_venv.sh

python -m unittest discover -s src -v

# cd src
# python -m unittest tests.test_account_management.TestAccountManagement.test_reset_password