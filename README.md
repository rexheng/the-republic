# The Republic

Full-stack research intelligence platform combining an interactive knowledge graph, autonomous AI agents, on-chain paper submissions, and LMSR prediction markets on research outcomes.

**Live:** [the-republic.vercel.app](https://the-republic.vercel.app)

## Features

- **Knowledge Graph** — Semantic Scholar-powered citation graph with on-chain paper submissions
- **Agent Swarm** — Five AI agents (Iris, Atlas, Tensor, Sage, Hermes) that analyse papers, generate hypotheses, and run forensic checks
- **RALPH Engine** — Retrieval-Augmented Literature Pipeline for Hypotheses: autonomous hypothesis generation from live paper streams
- **Prediction Markets** — LMSR-based on-chain markets on research outcomes
- **Dual-Chain** — Flare Coston2 (human verification) + Plasma testnet (AI agent transactions)
- **TRiSM Guardrails** — Hallucination detection, drift monitoring, deontic compliance scoring

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 6, Tailwind CSS, Radix UI, Framer Motion |
| Auth | Privy (wallet + social login) |
| Blockchain | ethers.js, Hardhat, Solidity |
| LLM | Anthropic Claude, Google Gemini, OpenAI, OpenRouter (user keys) |
| Data | Semantic Scholar API, arXiv, OpenAlex |
| Hosting | Vercel (static + serverless functions) |

## Local Development

```bash
git clone https://github.com/rexheng/the-republic.git
cd the-republic
npm install
cd frontend && npm install && cd ..
cd frontend && npm run dev
```

Frontend runs at `http://localhost:5173`.

## Environment Variables

```
# Project root (for contract deployment)
PRIVATE_KEY=your_wallet_private_key

# Vercel dashboard
S2_API_KEY=           # Semantic Scholar (optional, increases rate limits)
ANTHROPIC_API_KEY=    # Server-side Claude fallback (optional)
GEMINI_API_KEY=       # Server-side Gemini fallback (optional)
VITE_PRIVY_APP_ID=    # Privy app ID
VITE_PRIVY_CLIENT_ID= # Privy client ID
```

Users supply their own LLM API keys via the in-app settings panel (stored in sessionStorage only).

## Smart Contracts (Flare Coston2 Testnet)

| Contract | Address |
|----------|---------|
| ResearchGraph | `0xa67F7685584536c58521B5F1BE31420F6C25286E` |
| ResearchToken | `0xC7449900A141b235cF110De8690ddd8fB2Da911F` |
| MockUSDC | `0xe2f9947545c29B171C2528E70EF2E10EB4dCa5c3` |
| PredictionMarket | `0xa81C1C6E54D0Dc3d3339aBD8646A6001FA209244` |

```bash
# Deploy contracts
npx hardhat run scripts/deploy.js --network coston2
npx hardhat run scripts/deployPlasma.js --network plasma
npx hardhat test
```

## Project Structure

```
api/          Vercel serverless functions (LLM proxy, KG CRUD, agents, oracle, forensics)
contracts/    Solidity smart contracts
frontend/     React + Vite app
  src/
    components/   UI components
    utils/        RALPH engine, LLM client, PDF parser
    config.jsx    Network config, ABIs
scripts/      Hardhat deployment
```

## Agent Castes

| Agent | Caste | Role |
|-------|-------|------|
| Iris | Guardian | Methodological rigour, replication analysis |
| Atlas | Philosopher | Cross-domain synthesis, knowledge mapping |
| Tensor | Producer | Statistical validation, quantitative analysis |
| Sage | Philosopher | Theoretical frameworks, conceptual analysis |
| Hermes | Producer | Data retrieval, citation tracking, API integration |

## Deployment

```bash
npm i -g vercel
vercel --prod
```

Build: `cd frontend && npm install && CI=false npm run build`

## Licence

MIT
