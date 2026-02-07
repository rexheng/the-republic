#!/bin/bash

# Kaggle Competition Workflow - Setup Script

echo "=========================================="
echo "Kaggle Competition Workflow Setup"
echo "=========================================="

# Check Python
echo ""
echo "Checking Python installation..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✓ Found: $PYTHON_VERSION"
else
    echo "❌ Python 3 is not installed"
    echo "Please install Python 3.7+ from https://python.org"
    exit 1
fi

# Check pip
echo ""
echo "Checking pip installation..."
if command -v pip3 &> /dev/null; then
    PIP_VERSION=$(pip3 --version)
    echo "✓ Found: $PIP_VERSION"
else
    echo "❌ pip3 is not installed"
    echo "Please install pip3"
    exit 1
fi

# Install Node dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install
if [ $? -eq 0 ]; then
    echo "✓ Node.js dependencies installed"
else
    echo "❌ Failed to install Node.js dependencies"
    exit 1
fi

# Install Python dependencies
echo ""
echo "Installing Python dependencies..."
pip3 install -r python/requirements.txt
if [ $? -eq 0 ]; then
    echo "✓ Python dependencies installed"
else
    echo "❌ Failed to install Python dependencies"
    exit 1
fi

# Check Kaggle CLI
echo ""
echo "Checking Kaggle CLI..."
if command -v kaggle &> /dev/null; then
    echo "✓ Kaggle CLI is installed"
else
    echo "⚠ Kaggle CLI not found in PATH"
    echo "Installing Kaggle CLI..."
    pip3 install kaggle
fi

# Check Kaggle credentials
echo ""
echo "Checking Kaggle credentials..."
if [ -f ~/.kaggle/kaggle.json ]; then
    echo "✓ Kaggle credentials found at ~/.kaggle/kaggle.json"
else
    echo "⚠ No Kaggle credentials found"
    echo ""
    echo "To configure Kaggle API:"
    echo "1. Go to https://kaggle.com/settings"
    echo "2. Click 'Create New API Token'"
    echo "3. Move kaggle.json to ~/.kaggle/"
    echo "4. Run: chmod 600 ~/.kaggle/kaggle.json"
    echo ""
    echo "Or provide your API token in the frontend when starting a pipeline."
fi

# Create directories
echo ""
echo "Creating data directories..."
mkdir -p data
mkdir -p submissions
echo "✓ Directories created"

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "To start the backend:"
echo "  npm start"
echo ""
echo "Server will run on http://localhost:3001"
echo "WebSocket on ws://localhost:3001"
echo ""
