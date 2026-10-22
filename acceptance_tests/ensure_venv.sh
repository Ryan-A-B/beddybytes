#!/bin/bash
set -e

if [ -z "$VIRTUAL_ENV" ]; then
    echo "Please activate the virtual environment first. (source venv/bin/activate)"
    exit 1
fi