#!/bin/bash
# Quick launcher for Niftty Playground
# Usage: ./run-playground.sh

cd "$(dirname "$0")"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Launch the playground
echo "🐚 Launching Niftty Playground..."
echo ""
npm run playground
