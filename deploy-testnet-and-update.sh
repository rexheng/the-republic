#!/bin/bash

echo "🚀 Deploying to Flare Testnet & Updating Vercel"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check balance
echo "1️⃣  Checking wallet balance..."
node check-testnet-balance.js
echo ""

# Ask to continue
read -p "Do you have testnet tokens? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo ""
    echo "❌ Get testnet tokens first!"
    echo ""
    echo "Visit: https://faucet.flare.network/coston2"
    echo "Address: 0xE7C5bB914828e198f3aEA2b415270A233F47b6F1"
    echo ""
    exit 1
fi

echo ""
echo "2️⃣  Deploying contracts to Flare Coston2..."
npm run deploy:flare

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Deployment failed!"
    echo "Make sure you have enough testnet tokens."
    exit 1
fi

echo ""
echo "3️⃣  Deployment successful!"
echo ""

# Read deployment addresses
if [ -f deployment.json ]; then
    echo "📋 Contract Addresses:"
    cat deployment.json | grep -E "ResearchGraph|ResearchToken|MockUSDC" | head -3
    echo ""

    RESEARCH_GRAPH=$(cat deployment.json | grep ResearchGraph | cut -d'"' -f4)
    RESEARCH_TOKEN=$(cat deployment.json | grep ResearchToken | cut -d'"' -f4)
    USDC=$(cat deployment.json | grep MockUSDC | cut -d'"' -f4)

    echo "4️⃣  Updating frontend/.env.production..."
    cat > frontend/.env.production << EOF
# Flare Coston2 Testnet Contract Addresses
REACT_APP_RESEARCH_GRAPH=$RESEARCH_GRAPH
REACT_APP_RESEARCH_TOKEN=$RESEARCH_TOKEN
REACT_APP_USDC=$USDC
REACT_APP_NETWORK=flare
REACT_APP_CHAIN_ID=114
EOF

    echo "✅ Updated!"
    echo ""

    echo "5️⃣  Committing changes..."
    git add frontend/.env.production deployment.json
    git commit -m "Deploy to Flare Coston2 testnet

Contracts:
- ResearchGraph: $RESEARCH_GRAPH
- ResearchToken: $RESEARCH_TOKEN
- MockUSDC: $USDC"

    echo ""
    echo "6️⃣  Pushing to trigger Vercel redeploy..."
    git push

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✨ Done!"
    echo ""
    echo "Your live demo will update in ~2 minutes:"
    echo "https://knowledge-graph-delta.vercel.app"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Wait for Vercel to redeploy"
    echo "  2. Test the live demo"
    echo "  3. Record your demo video"
    echo "  4. Submit to DoraHacks!"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
    echo "⚠️  deployment.json not found!"
    echo "Update Vercel manually with the addresses shown above."
fi
