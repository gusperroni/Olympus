#!/bin/bash
echo "================================================================"
echo " ⚠️  DEPRECATED: Olympus is no longer maintained."
echo ""
echo " Hermes Agent now ships a native web dashboard. Use it instead:"
echo ""
echo "     hermes dashboard      ->  http://127.0.0.1:9119"
echo ""
echo " Migration guide: https://github.com/gusperroni/Olympus#readme"
echo " Docs: https://hermes-agent.nousresearch.com/docs/user-guide/features/web-dashboard"
echo "================================================================"
echo ""
echo "Starting Olympus ✧ Hermes Agent Dashboard (legacy, unsupported)..."

# Setup venv if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install requirements
echo "Verifying requirements..."
pip install -r execution/dashboard/requirements.txt --quiet

# Start Uvicorn
echo "Launching Olympus on http://127.0.0.1:8787..."
python3 -m uvicorn execution.dashboard.fastapi_app:app --host 127.0.0.1 --port 8787 --reload
