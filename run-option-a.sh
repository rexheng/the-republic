#!/usr/bin/env bash
# Option A: Run full local dev (use 3 terminals - see RUN_OPTION_A.md)
set -e
cd "$(dirname "$0")"

echo "Option A needs 3 terminals. This script can only do one at a time."
echo ""
echo "Choose:"
echo "  1) Start Hardhat node (then run this script again with 2, then 3)"
echo "  2) Deploy contracts (run after node is up)"
echo "  3) Start frontend"
echo ""
read -p "Enter 1, 2, or 3: " choice

case "$choice" in
  1)
    echo "Starting Hardhat node (leave this running)..."
    npx hardhat node
    ;;
  2)
    echo "Deploying to localhost..."
    npx hardhat run scripts/deploy.js --network localhost
    echo ""
    echo "If addresses differ from frontend/src/config.js, update CONTRACTS there."
    ;;
  3)
    echo "Starting frontend..."
    npm run frontend
    ;;
  *)
    echo "Invalid choice. Use 1, 2, or 3."
    exit 1
    ;;
esac
