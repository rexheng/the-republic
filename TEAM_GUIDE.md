# THE REPUBLIC — Team Guide

## Live URLs
- **Full App:** https://frontend-phi-lime-58.vercel.app
- **Track A (DeFi):** https://frontend-phi-lime-58.vercel.app/?track=defi
- **Track B (AI Swarm):** https://frontend-phi-lime-58.vercel.app/?track=ai
- **Track C (Consumer):** https://frontend-phi-lime-58.vercel.app/?track=consumer

## Local Dev
```bash
cd frontend && npm run dev    # React app on localhost:3000
cd backend && npm start        # Express + WebSocket on localhost:3001
```

## What Each Track Shows

### ?track=defi (Prediction Markets + DeFi)
**Tabs:** Vision | Network | Launch | Markets | Treasury | Live Feed
- **Markets tab** = hero. LMSR prediction markets with YES/NO pricing, positions, trade UI.
- **Launch tab** = submit paper ($50 USDC on Plasma), triggers FDC verification + market creation.
- **Network tab** = knowledge graph showing papers as nodes.
- Emphasize: LMSR math, Flare (FDC/FTSO/RNG), Plasma (USDC settlement), token economics.
- Also qualifies for **Flare bounty ($5K)** and **Plasma bounty ($5K)**.

### ?track=ai (AI Middleware & Application)
**Tabs:** Vision | Network | Agent Swarm | AI Lab | Kaggle Agent | Live Feed
- **Agent Swarm tab** = hero. Swarm Control + TRiSM Guardrails dual view.
  - Select paper, launch analysis, watch agents work sequentially.
  - TRiSM tab: hallucination/drift scores, Protocol Integrity Stream, forensic rules.
- **AI Lab tab** = RALPH autonomous discovery, multi-agent pipelines (Replicate/Discover/RALPH).
- Emphasize: 3 agent castes, RepublicEngine, TRiSM, budget-constrained execution, forensics.

### ?track=consumer (New Consumer Primitives)
**Tabs:** Vision | Network | Library | Launch | Live Feed | Paper2Agent | Markets
- **Live Feed tab** = hero. Real-time activity stream (launches, agent reviews, market moves, alerts).
- **Paper2Agent tab** = turn papers into MCP tools (3-phase pipeline).
- **Network tab** = knowledge graph with social discovery.
- Emphasize: "pump.fun for papers, Polymarket for science, arXiv as social feed."

## Smart Contracts (deployed or deployable)
- `contracts/ResearchGraph.sol` — paper submission, review, citations, FDC verification
- `contracts/ResearchToken.sol` — ERC20 governance token
- `contracts/PredictionMarket.sol` — LMSR markets with WAD math
- Deploy: `npx hardhat run scripts/deploy.js --network flare_testnet` / `--network plasma_testnet`

## Backend Services
- `republic-engine.js` — master orchestrator (3 agent loops, WebSocket heartbeat)
- `agent-gateway/` — LLM provider (Gemini primary, Claude fallback) + budget tracking
- `trism/` — hallucination checker, drift detector, circuit breaker
- `forensics/` — deontic scorer, traceability scorer

## Key Files to Know
| What | Where |
|------|-------|
| Main app + routing | `frontend/src/App.jsx` |
| LMSR markets | `frontend/src/components/PredictionMarket.jsx` |
| Agent swarm | `frontend/src/components/AgentCommandCentre.jsx` |
| Live feed | `frontend/src/components/ResearchFeed.jsx` |
| Knowledge graph | `frontend/src/components/KnowledgeGraph.jsx` |
| AI Research Lab | `frontend/src/components/AIResearchLab.jsx` |
| Pitch deck content | `PITCH_DECKS.md` |

## Env Variables Needed
```
GEMINI_API_KEY=xxx          # for agent gateway
ANTHROPIC_API_KEY=xxx       # fallback LLM
PRIVATE_KEY=xxx             # deployer wallet
SEMANTIC_SCHOLAR_API_KEY=xxx
```

---

# SPRINT PLAN — Now to 12:00 Noon

**Deadline: 2026-02-08 12:00 (Oxford time)**

## Phase 1: Polish & Fix (Now - 09:30) ~1.5hrs
| Who | Task | Priority |
|-----|------|----------|
| **All** | Test all 3 track URLs on Vercel, note any broken features | CRITICAL |
| **Teammate A (DeFi)** | Test Markets tab end-to-end. Add more demo markets if needed. Test "Launch" paper flow. | HIGH |
| **Teammate B (AI)** | Start backend (`npm start`), test Agent Swarm with real Gemini API. Verify TRiSM panel shows live data. | HIGH |
| **Teammate C (Consumer)** | Test Live Feed auto-updates. Test Paper2Agent pipeline. Verify Knowledge Graph loads. | HIGH |

## Phase 2: Demo Videos (09:30 - 10:30) ~1hr
| Who | Task |
|-----|------|
| **Teammate A** | Record 2-min video for DeFi track. Use `?track=defi`. Script: Problem (15s) -> Solution (30s) -> Live Demo (60s) -> Architecture (15s) -> Vision (15s) |
| **Teammate B** | Record 2-min video for AI track. Use `?track=ai`. Show agent swarm running, TRiSM catching drift, pipeline execution. |
| **Teammate C** | Record 2-min video for Consumer track. Use `?track=consumer`. Show feed, graph exploration, Paper2Agent, full lifecycle. |
| **Tool:** Loom.com (free, instant) or QuickTime screen record + voiceover |

## Phase 3: Slide Decks (10:30 - 11:00) ~30min
| Who | Task |
|-----|------|
| **All** | Open `PITCH_DECKS.md`, copy your deck section into [Gamma.app](https://gamma.app) -> "Paste text" -> auto-generates slides |
| | Tweak visuals, add screenshots from your demo recording |
| | Export as PDF or keep as Gamma link |

## Phase 4: Submission on DoraHacks (11:00 - 11:45) ~45min
| Task | Details |
|------|---------|
| GitHub link | https://github.com/Meugenn/knowledge-graph |
| Demo videos | Upload to YouTube/Loom, paste links |
| Submission form | Fill for **3 main tracks** + **Flare** + **Plasma** bounties |
| README | Quick update: add track descriptions, architecture diagram, video links |
| **Triple check** | All links work, videos play, Vercel URL loads |

## Phase 5: Buffer (11:45 - 12:00)
- Fix any last-minute issues
- Submit before noon sharp

## Key Reminders
- Each track submission needs: (1) pitch video link, (2) code repo link
- Flare submission needs: mention FDC/FTSO/RNG usage + "Feedback" section in README
- Plasma submission needs: demo video + short written explanation
- You can submit the SAME repo to ALL tracks — the URL params show different views
