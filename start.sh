#!/bin/bash
echo "Starting Olympus ✧ Hermes Agent Dashboard..."

# Setup venv if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install requirements
echo "Verifying requirements..."
pip list | grep -F -f <(sed 's/[=><].*//' execution/dashboard/requirements.txt) > /dev/null || pip install -r execution/dashboard/requirements.txt

# Start Uvicorn
echo "Launching Olympus on http://127.0.0.1:8787..."
python3 -m uvicorn execution.dashboard.fastapi_app:app --host 127.0.0.1 --port 8787 --reload
