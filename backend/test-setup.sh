#!/bin/bash

# Test script for Kaggle Competition Workflow

echo "=========================================="
echo "Testing Kaggle Workflow Setup"
echo "=========================================="

PASS=0
FAIL=0

# Test 1: Node.js
echo ""
echo "Test 1: Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ PASS: Node.js $NODE_VERSION"
    ((PASS++))
else
    echo "❌ FAIL: Node.js not found"
    ((FAIL++))
fi

# Test 2: Python 3
echo ""
echo "Test 2: Checking Python 3..."
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo "✅ PASS: $PYTHON_VERSION"
    ((PASS++))
else
    echo "❌ FAIL: Python 3 not found"
    ((FAIL++))
fi

# Test 3: npm packages
echo ""
echo "Test 3: Checking Node modules..."
if [ -d "node_modules" ]; then
    echo "✅ PASS: node_modules exists"
    ((PASS++))
else
    echo "❌ FAIL: node_modules not found (run: npm install)"
    ((FAIL++))
fi

# Test 4: Python scripts
echo ""
echo "Test 4: Checking Python scripts..."
if [ -f "python/kaggle_downloader.py" ] && [ -f "python/data_analyzer.py" ] && [ -f "python/model_trainer.py" ]; then
    echo "✅ PASS: All Python scripts found"
    ((PASS++))
else
    echo "❌ FAIL: Python scripts missing"
    ((FAIL++))
fi

# Test 5: Express server
echo ""
echo "Test 5: Checking Express server..."
if [ -f "src/index.js" ]; then
    echo "✅ PASS: Express server file exists"
    ((PASS++))
else
    echo "❌ FAIL: src/index.js not found"
    ((FAIL++))
fi

# Test 6: Directories
echo ""
echo "Test 6: Checking directories..."
if [ -d "data" ] && [ -d "submissions" ]; then
    echo "✅ PASS: data/ and submissions/ directories exist"
    ((PASS++))
else
    echo "❌ FAIL: Required directories missing"
    ((FAIL++))
fi

# Test 7: Python packages
echo ""
echo "Test 7: Checking Python packages..."
MISSING_PACKAGES=""
for pkg in kaggle pandas numpy sklearn; do
    if ! python3 -c "import $pkg" 2>/dev/null; then
        MISSING_PACKAGES="$MISSING_PACKAGES $pkg"
    fi
done

if [ -z "$MISSING_PACKAGES" ]; then
    echo "✅ PASS: All Python packages installed"
    ((PASS++))
else
    echo "⚠️  WARN: Missing Python packages:$MISSING_PACKAGES"
    echo "   Run: pip3 install -r python/requirements.txt"
    ((FAIL++))
fi

# Test 8: Kaggle CLI
echo ""
echo "Test 8: Checking Kaggle CLI..."
if command -v kaggle &> /dev/null; then
    echo "✅ PASS: Kaggle CLI installed"
    ((PASS++))
else
    echo "⚠️  WARN: Kaggle CLI not in PATH"
    echo "   Run: pip3 install kaggle"
    ((FAIL++))
fi

# Test 9: Port availability
echo ""
echo "Test 9: Checking port 3001..."
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️  WARN: Port 3001 is already in use"
    echo "   Stop the process or use a different port"
    ((FAIL++))
else
    echo "✅ PASS: Port 3001 is available"
    ((PASS++))
fi

# Test 10: Frontend component
echo ""
echo "Test 10: Checking frontend component..."
if [ -f "../frontend/src/components/KaggleLab.js" ]; then
    echo "✅ PASS: KaggleLab.js component exists"
    ((PASS++))
else
    echo "❌ FAIL: KaggleLab.js not found"
    ((FAIL++))
fi

# Summary
echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo "✅ Passed: $PASS"
echo "❌ Failed: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "🎉 All tests passed! Ready to start:"
    echo "   npm start"
    echo ""
    exit 0
elif [ $FAIL -le 2 ]; then
    echo "⚠️  Minor issues detected, but should work"
    echo "   npm start"
    echo ""
    exit 0
else
    echo "❌ Setup incomplete. Please fix the issues above."
    echo ""
    exit 1
fi
