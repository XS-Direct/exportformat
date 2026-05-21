#!/bin/bash
# Pace Editor Extension — auto-update script
# Run this to pull the latest version from GitHub and rebuild.
# After running, reload the extension in chrome://extensions/

set -e

cd "$(dirname "$0")"

echo "Pulling latest changes..."
git pull origin main

echo "Installing dependencies..."
npm install --silent

echo "Building extension..."
npm run build

echo ""
echo "✅ Update complete! Now reload the extension:"
echo "   1. Open chrome://extensions/"
echo "   2. Click the reload button (↻) on Pace Visual Template Editor"
echo ""
