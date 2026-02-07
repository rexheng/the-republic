# Option A: Full Local Development

Run the project locally with Hardhat node, deployed contracts, and the React frontend.

---

## One-time fix: npm cache permission (if frontend install fails)

If `npm install` in the frontend fails with **"Your cache folder contains root-owned files"**, run:

```bash
sudo chown -R $(whoami) ~/.npm
```

Then run `npm install` again in `frontend/`.

---

## Step 1: Install dependencies

```bash
cd /Users/jonah/Desktop/knowledge-graph
npm install
cd frontend && npm install && cd ..
```

---

## Step 2: Start the local blockchain (Terminal 1)

Leave this running.

```bash
cd /Users/jonah/Desktop/knowledge-graph
npx hardhat node
```

Wait until you see: **"Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/"**

---

## Step 3: Deploy contracts (Terminal 2)

Run this **after** the node is ready.

```bash
cd /Users/jonah/Desktop/knowledge-graph
npx hardhat run scripts/deploy.js --network localhost
```

Addresses are saved to `deployment.json`. The frontend `config.js` already has default local addresses; if this deploy prints different ones, copy them into `frontend/src/config.js` under `CONTRACTS`.

---

## Step 4: Start the frontend (Terminal 3)

```bash
cd /Users/jonah/Desktop/knowledge-graph
npm run frontend
```

Then open **http://localhost:3000**

---

## Step 5: Use the app in the browser

1. **MetaMask**
   - Add network: **RPC URL** `http://127.0.0.1:8545`, **Chain ID** `1337`
   - Import an account: use one of the **private keys** printed in Terminal 1 (Account #0, #1, etc.)

2. **Test USDC** (for submissions/reviews)
   - In MetaMask: Add token → Custom token → paste the **MockUSDC** address from the deploy output (or from `frontend/src/config.js` → `CONTRACTS.USDC`)
   - Get test USDC: in project root run  
     `npx hardhat console --network localhost`  
     then:  
     `const u = await ethers.getContractAt("MockUSDC", "YOUR_USDC_ADDRESS"); await u.faucet();`

---

## Quick reference

| Terminal | Command |
|----------|---------|
| 1 | `npx hardhat node` |
| 2 | `npx hardhat run scripts/deploy.js --network localhost` |
| 3 | `npm run frontend` → open http://localhost:3000 |
