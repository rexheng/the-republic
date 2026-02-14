# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**The Republic** is a decentralized research knowledge graph and academic publishing platform. It combines Flare Network oracles, Plasma Network USDC payments, AI agent swarms with TRiSM safety guardrails, LMSR prediction markets, and knowledge graph visualization.

Live demo: https://the-republic-ashy.vercel.app/

## Commands

### Smart Contracts (from root)
```bash
npm run compile            # Compile Solidity contracts with Hardhat
npm test                   # Run Hardhat tests (Chai/Mocha)
npx hardhat test test/ResearchGraph.test.js   # Run a single test file
npm run deploy:flare       # Deploy to Flare testnet (Coston2, chain 114)
npm run deploy:plasma      # Deploy to Plasma testnet (chain 9746)
```

### Frontend (from root or frontend/)
```bash
npm run frontend           # Start Vite dev server (from root)
cd frontend && npm run dev # Same thing, from frontend dir
cd frontend && npm run build  # Production build → frontend/build/
```

### Backend (from backend/)
```bash
cd backend && npm start    # Express server on :3001
cd backend && npm run seed # Seed knowledge graph data
```

### Full Stack
```bash
npm run dev                # Runs frontend + backend concurrently
```

### Environment
Copy `.env.example` to `.env` and fill in keys. Backend validates env vars on startup and exits if placeholder values like `'your_private_key_here'` are detected.

## Architecture

### Three-Layer Structure

```
the-republic/
├── contracts/      # Solidity smart contracts (Hardhat)
├── frontend/       # React + Vite + Tailwind CSS
└── backend/        # Express + WebSocket + AI services
```

Each layer has its own `package.json`. The root `package.json` handles Hardhat and orchestration scripts.

### Smart Contracts (Solidity 0.8.20, OpenZeppelin v5)

- **ResearchGraph.sol** — Core platform: paper submission ($50 USDC fee), peer review ($100 USDC reward), citation tracking, reviewer staking. Integrates Flare FDC for DOI verification, FTSO for price feeds, RNG for reviewer assignment.
- **ResearchToken.sol** — ERC20 governance token (1B max supply). Only ResearchGraph can mint. Earned via paper acceptance, citations, replications.
- **PredictionMarket.sol** — LMSR prediction markets on paper replication outcomes. Auto-resolves when papers hit acceptance threshold.
- **MockFlareContracts.sol** — Local testing mocks for Flare services.

Deployed contract addresses are in `frontend/src/config.jsx` and `deployment.json`.

### Frontend (React 18 + Vite + Tailwind)

**Multi-track demo system** controlled by `?track=defi|ai|consumer` query param in `App.jsx`. Each track shows different tabs/features with distinct accent colors.

Key architectural patterns:
- **config.jsx** — Single source of truth for contract addresses, ABIs, and network configs. All blockchain interaction goes through ethers.js with these ABIs.
- **components/** — ~30 components. Major ones: `KnowledgeGraph.jsx` (force-directed graph viz), `PredictionMarket.jsx` (LMSR interface), `AIResearchLab.jsx`, `Paper2Agent.jsx`, `KaggleLab.jsx`, `ResearchFeed.jsx`.
- **utils/** — ~18 utility modules. `semanticScholar.jsx` (API wrapper), `agentOrchestrator.jsx` (multi-agent coordination), `evaluation.jsx` (quality metrics), `gnn.jsx` (graph neural net), `llm.jsx` (LLM abstraction), `pdfParser.js`.
- **ui/** — Radix UI primitives styled with Tailwind + class-variance-authority.

### Backend (Express + WebSocket)

Entry point: `backend/src/index.js`. Mounts API routes and starts WebSocket server for real-time logs.

**Service modules** in `backend/services/`:
- **kg/** — In-memory knowledge graph with JSON file persistence (`data/kg.json`). Supports citation ring detection and causal density analysis.
- **republic-engine.js** — Main orchestrator combining all services. Broadcasts via WebSocket.
- **swarm/** — Agent swarm with three castes: Philosophers (graph reasoning), Warriors (forensic verification), Artisans (market pricing). Runs on 5-second heartbeat.
- **trism/** — TRiSM safety framework: hallucination detection, drift monitoring, circuit breakers.
- **forensics/** — Linguistic analysis, plagiarism checking, citation verification.
- **paper2agent/** — Converts papers to executable MCP servers.
- **agent-gateway/** — Routes requests to AI agents with TRiSM safety hooks.

**API routes** in `backend/src/routes/`: `/api/kg`, `/api/agents`, `/api/oracle`, `/api/forensics`, `/api/trism`, `/api/papers`, `/api/blockchain`, `/api/swarm`, `/api/republic`, `/api/semantic-scholar` (proxy), `/api/polymarket` (proxy), `/api/kaggle`.

AI integration uses Google Gemini (`@google/generative-ai`).

### Dual-Chain Architecture

- **Flare (Coston2)** — Oracle services: FDC for CrossRef DOI verification, FTSO for token price feeds, RNG for fair reviewer assignment.
- **Plasma** — USDC stablecoin payments for paper submission fees and reviewer rewards.

## Deployment

- **Frontend** deploys to Vercel. Config in `vercel.json`: builds from `frontend/`, outputs to `frontend/build/`.
- **Smart contracts** deploy via Hardhat scripts in `scripts/`. Generates `deployment.json`.
- **Backend** requires WebSocket support and Python for Kaggle pipeline (`backend/python/`).
