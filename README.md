# The Republic

> Autonomous AI research agents on a decentralised knowledge graph — with blockchain verification, prediction markets, and forensic guardrails.

**[Live](https://the-republic-ashy.vercel.app)** · **[GitHub](https://github.com/rexheng/the-republic)**

---

## Overview

The Republic is a full-stack research intelligence platform that combines:

- **Knowledge Graph** — interactive Semantic Scholar-powered citation graph with on-chain paper submissions
- **Agent Swarm** — autonomous AI agents (five castes: Iris, Atlas, Tensor, Sage, Hermes) that analyse papers, generate hypotheses, and run forensic checks
- **RALPH Engine** — Retrieval-Augmented Literature Pipeline for Hypotheses: autonomous hypothesis generation from live paper streams
- **Prediction Markets** — LMSR-based on-chain markets on research outcomes
- **Dual-Chain Architecture** — Flare Coston2 (human verification) + Plasma testnet (AI agent transactions)
- **TRiSM Guardrails** — Trust, Risk, and Security Management: hallucination detection, drift monitoring, deontic compliance scoring
- **Kaggle Agent Lab** — paper-driven ML pipelines (requires dedicated backend)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, Tailwind CSS, Radix UI, Framer Motion |
| Auth | Privy (wallet + social login) |
| Blockchain | ethers.js, Hardhat, Solidity (Flare Coston2 + Plasma testnet) |
| LLM | Anthropic Claude, Google Gemini, OpenAI, OpenRouter (user-provided API keys) |
| Data | Semantic Scholar API, arXiv, OpenAlex |
| Hosting | Vercel (static + serverless functions) |

## Deployed Contracts (Flare Coston2 Testnet)

| Contract | Address |
|----------|---------|
| ResearchGraph | `0xa67F7685584536c58521B5F1BE31420F6C25286E` |
| ResearchToken | `0xC7449900A141b235cF110De8690ddd8fB2Da911F` |
| MockUSDC | `0xe2f9947545c29B171C2528E70EF2E10EB4dCa5c3` |
| PredictionMarket | `0xa81C1C6E54D0Dc3d3339aBD8646A6001FA209244` |

## Project Structure

```
the-republic/
├── api/                    # Vercel serverless functions
│   ├── agents/             # Agent gateway (list, budget, chat)
│   ├── blockchain/         # Dual-chain status
│   ├── forensics/          # Deontic + traceability scoring
│   ├── kg/                 # Knowledge graph CRUD
│   ├── llm/                # LLM proxy (multi-provider)
│   ├── oracle/             # Paper search (arXiv + Semantic Scholar)
│   ├── polymarket/         # Polymarket event proxy
│   ├── republic/           # Republic engine status (polling)
│   ├── semantic-scholar/   # S2 API proxy
│   ├── swarm/              # Swarm engine status (polling)
│   ├── trism/              # TRiSM guardrail checks
│   └── health.js           # Health check
├── contracts/              # Solidity smart contracts
├── frontend/               # React + Vite application
│   └── src/
│       ├── components/     # UI components
│       ├── utils/          # RALPH engine, LLM, bulk import, PDF parser
│       └── config.jsx      # Network config, contract addresses, ABIs
├── backend/                # Legacy Express server (reference)
│   ├── services/           # Service implementations
│   └── src/                # Routes
├── scripts/                # Hardhat deployment scripts
└── test/                   # Contract tests
```

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Local Development

```bash
# Clone
git clone https://github.com/rexheng/the-republic.git
cd the-republic

# Install root dependencies (Hardhat, contracts)
npm install

# Install frontend dependencies
cd frontend && npm install && cd ..

# Start frontend dev server
cd frontend && npm run dev
```

The frontend runs at `http://localhost:5173`. API calls to `/api/*` are handled by Vercel serverless functions in production.

### Environment Variables

Create a `.env` file in the project root for contract deployment:

```
PRIVATE_KEY=your_wallet_private_key
```

For Vercel deployment, set these in the Vercel dashboard:

| Variable | Purpose |
|----------|---------|
| `S2_API_KEY` | Semantic Scholar API key (optional, increases rate limits) |
| `ANTHROPIC_API_KEY` | Server-side Claude fallback (optional) |
| `GEMINI_API_KEY` | Server-side Gemini fallback (optional) |
| `VITE_PRIVY_APP_ID` | Privy authentication app ID |
| `VITE_PRIVY_CLIENT_ID` | Privy client ID |

Users provide their own LLM API keys via the in-app settings panel (stored in sessionStorage, never persisted).

### Deploy to Vercel

```bash
npm i -g vercel
vercel --prod
```

The build command is configured in `vercel.json`:
- Build: `cd frontend && npm install && CI=false npm run build`
- Output: `frontend/build`
- API functions: `api/` directory (auto-detected)

### Smart Contract Deployment

```bash
# Deploy to Flare Coston2
npx hardhat run scripts/deploy.js --network coston2

# Deploy to Plasma testnet
npx hardhat run scripts/deployPlasma.js --network plasma

# Run tests
npx hardhat test
```

## Architecture

### Serverless API

All backend functionality runs as Vercel serverless functions under `/api/`. Each function is stateless and handles one concern:

- **LLM Proxy** (`/api/llm/chat`) — routes to Claude/Gemini/OpenAI/OpenRouter based on API key prefix
- **Knowledge Graph** (`/api/kg`) — in-memory demo papers with CRUD operations
- **Agent Gateway** (`/api/agents`) — five hardcoded agents with caste-based budget limits
- **Oracle** (`/api/oracle/search`) — parallel arXiv + Semantic Scholar paper search
- **Forensics** (`/api/forensics/analyse`) — deontic scoring + traceability analysis
- **TRiSM** (`/api/trism/check`) — hallucination detection + drift monitoring

### Dual-Chain Design

```
Human Chain (Flare Coston2)          AI Chain (Plasma Testnet)
├── Paper submissions                ├── Agent transactions
├── Peer reviews                     ├── Autonomous operations
├── Prediction markets               └── Cross-chain bridge events
├── FDC data verification
└── FTSO price oracles
```

### Agent Castes

| Agent | Caste | Role |
|-------|-------|------|
| Iris | Guardian | Methodological rigour, replication analysis |
| Atlas | Philosopher | Cross-domain synthesis, knowledge mapping |
| Tensor | Producer | Statistical validation, quantitative analysis |
| Sage | Philosopher | Theoretical frameworks, conceptual analysis |
| Hermes | Producer | Data retrieval, citation tracking, API integration |

## Security

- No private keys or API secrets in the codebase
- User LLM API keys stored in `sessionStorage` only (cleared on tab close)
- Semantic Scholar API key proxied server-side
- Security headers configured (X-Content-Type-Options, X-Frame-Options, Referrer-Policy)
- See [SECURITY_GUIDE.md](./SECURITY_GUIDE.md) for details

## Licence

MIT
