# THE REPUBLIC — Pitch Decks for ETH Oxford 2026

> Paste each deck into [Gamma.app](https://gamma.app) or Google Slides.
> For video: screen-record narrating over slides + live demo.

---

# DECK A: Prediction Markets + DeFi

## Slide 1: The Problem
**Headline:** 70% of Published Research Cannot Be Replicated
**Key points:**
- The "replication crisis" — billions wasted on non-reproducible findings
- Peer review has zero financial skin-in-the-game
- No mechanism to price the *trustworthiness* of a scientific claim
- Result: bad science persists because there's no market signal

**Visual:** Stat showing $28B wasted annually on irreproducible preclinical research (NIH estimate)

---

## Slide 2: The Solution
**Headline:** Prediction Markets for Scientific Truth
**Key points:**
- LMSR (Logarithmic Market Scoring Rule) prediction markets where anyone can bet on whether a paper will replicate
- Submit a paper → market auto-creates → crowd prices truth
- Financial incentives align with scientific accuracy
- If you know a paper is shaky, short it. If it's solid, go long.

**Visual:** Simple flow: Paper Published → Market Opens → Trading → Resolution → Payout

---

## Slide 3: How LMSR Works
**Headline:** Automated Market Making for Truth Discovery
**Key points:**
- `price_yes = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))`
- Liquidity parameter `b` ensures infinite liquidity — no order books needed
- Cost function with bounded loss for market maker
- Prices converge to true probability through trading
- Fixed-point WAD arithmetic (18 decimals) on-chain for precision

**Visual:** Price curve showing how LMSR responds to trades

---

## Slide 4: Dual-Chain Architecture
**Headline:** Flare Verifies, Plasma Settles
**Key points:**
- **Flare (Human Chain):** ResearchGraph.sol — paper submission, review assignment, verification
  - FDC: Verify DOIs exist in CrossRef/arXiv
  - FTSO: Real-time token price oracle
  - RNG: Anonymous reviewer selection (no conflicts of interest)
- **Plasma (AI Chain):** PredictionMarket.sol — USDC settlement
  - $50 USDC submission fee → market created
  - $100 USDC review rewards
  - Market payouts in USDC
- **Bridge:** Cross-chain event mirroring

**Visual:** Architecture diagram with two chains connected by bridge

---

## Slide 5: Token Economics
**Headline:** RESEARCH Token + USDC = Two-Token Economy
**Key points:**
- **USDC (Plasma):** Submission fees ($50), review rewards ($100), market trading
- **RESEARCH (Flare, ERC20):** Earned through contributions
  - Citation: +10 RESEARCH
  - Replication: +50 RESEARCH
  - Reviewers must stake 100 RESEARCH (skin in the game)
- Max supply 1B, initial mint 10M, minted by ResearchGraph contract only
- Staking creates accountability — bad reviewers lose stake

**Visual:** Token flow diagram: Submit → Review → Cite → Replicate

---

## Slide 6: Live Demo
**Headline:** The Bloomberg Terminal for Science
**Key points:**
- Launch a paper ($50 USDC) → LMSR market auto-creates
- Trade YES/NO shares on replication probability
- Watch real-time price discovery
- AI agents analyze and inform market
- Resolution → winners paid out

**Visual:** Screenshots of PredictionMarket UI + Knowledge Graph

---

## Slide 7: Market Opportunity
**Headline:** $30B Academic Publishing × $1T+ Prediction Markets
**Key points:**
- Academic publishing: $30B/year market, ripe for disruption
- Prediction markets: Polymarket proved product-market fit
- Replication crisis costs: $28B/year in wasted research funding
- First-mover in science prediction markets
- Every paper ever published = potential market

**Visual:** TAM/SAM/SOM circles

---

## Slide 8: The Vision
**Headline:** What if Every Scientific Claim Had a Price?
**Key points:**
- Phase 1: Prediction markets for paper replication (NOW)
- Phase 2: Markets for any scientific claim or hypothesis
- Phase 3: Decentralized funding — papers with high market confidence attract capital
- The Republic: where truth has a price and honesty pays

---

# DECK B: AI Middleware & Application

## Slide 1: The Problem
**Headline:** AI Agents Are Powerful But Unaccountable
**Key points:**
- Agent swarms can analyze millions of papers — but who watches the AI?
- Hallucination rates in LLMs: 15-30% for scientific content
- No standardized guardrails for production AI agent deployment
- Result: AI-generated analysis can't be trusted at scale

**Visual:** Stat showing hallucination rates across models

---

## Slide 2: The Solution
**Headline:** The First AI Civilization with Built-In Accountability
**Key points:**
- Plato's Republic as architecture: three agent castes, each with a role
- **Philosophers** — reason over the research graph, generate hypotheses
- **Warriors** — verify claims with linguistic forensics, catch fraud
- **Artisans** — price truth via prediction markets
- TRiSM guardrails at every step: Trust, Risk, Security Management

**Visual:** Three caste icons with roles and data flow between them

---

## Slide 3: Agent Swarm Architecture
**Headline:** RepublicEngine: An Autonomous Civilization Loop
**Key points:**
- Event-driven engine running 3 independent loops simultaneously
- Each loop: pick work from queue → execute → broadcast results via WebSocket
- 5-second heartbeat: vitals, queue status, market stats
- Budget-constrained: each caste has token spending limits
- Agents have their own wallets — autonomous on-chain actors

**Visual:** RepublicEngine loop diagram with 3 parallel streams

---

## Slide 4: TRiSM Guardrails
**Headline:** Production-Grade Safety for Agent Swarms
**Key points:**
- **Hallucination Checker:** Scores content against known facts (context-aware)
- **Drift Detector:** Tracks linguistic style consistency per agent over time
- **Circuit Breaker:** Automatic fail-safe — too many failures = swarm pauses
- Every agent output scored: `pass | warn | halt`
- 1,402 safety interventions logged and auditable
- Maps directly to Gartner's TRiSM framework

**Visual:** TRiSM dashboard screenshot with gauges and protocol integrity stream

---

## Slide 5: Linguistic Forensics
**Headline:** AI-Powered Fraud Detection for Science
**Key points:**
- **Deontic Scorer:** Analyzes obligation markers (should/must/can) — weak claims flag
- **Traceability Scorer:** Measures causal density and evidence chain completeness
- Combined: `syntheticEthosScore` (0-100)
- Verdicts: `credible | uncertain | suspicious`
- Papers flagged by Warriors face higher collateral in prediction markets

**Visual:** Example forensics output with scores

---

## Slide 6: Multi-Agent Pipelines
**Headline:** 6 Specialized Agents, 5 LLM Calls, Full Analysis
**Key points:**
- **Replication pipeline:** Iris (literature) → Atlas (architect) → Tensor + Sage + Formal (parallel) → Scribe
- **Frontier pipeline:** Nova (gaps) → Eureka (hypotheses) → Flux + Nexus + Formal (parallel) → Scribe
- **RALPH:** Autonomous discovery loop — agents find new papers, analyze, queue, repeat
- Each agent has temperature tuning, role-specific prompts, caste budget
- Topological sort ensures correct execution order

**Visual:** Pipeline DAG diagram

---

## Slide 7: Live Demo
**Headline:** Watch the Swarm Think
**Key points:**
- Select a paper → Launch Swarm Analysis
- Watch agents activate sequentially: status badges IDLE → WORKING → DONE
- See TRiSM scores after each output
- View Protocol Integrity Stream in real-time
- Expand analysis cards to read full agent output

**Visual:** Agent Command Centre screenshot

---

## Slide 8: The Vision
**Headline:** Commercially Deployable AI Agent Swarms
**Key points:**
- Theme 1 (Agent Swarms): RepublicEngine with 3 caste loops ✓
- Theme 2 (Constrained Execution): Budget limits, role constraints ✓
- Theme 3 (Robust Guardrails): TRiSM + Forensics = commercially viable ✓
- Next: Any organization can deploy a "Republic" of agents with auditable guardrails
- From research verification to any knowledge-intensive domain

---

# DECK C: New Consumer Primitives

## Slide 1: The Problem
**Headline:** Academic Publishing is Stuck in 1665
**Key points:**
- First scientific journal: 1665. The model hasn't changed since.
- $30B/year industry controlled by 5 publishers
- Authors pay to publish, reviewers work for free, readers pay to read
- Average peer review: 6-12 months. No real-time signal.
- Papers exist in PDFs. No interactivity, no engagement, no markets.

**Visual:** Timeline: 1665 → 2026, same model

---

## Slide 2: The Solution
**Headline:** pump.fun for Science, Polymarket for Truth, arXiv as a Social Feed
**Key points:**
- Papers launched like tokens ($50 USDC) with instant market creation
- Verified by autonomous AI swarms, not overworked volunteers
- Priced by prediction markets, not journal prestige
- Consumed via a real-time feed, not a PDF archive
- The first platform where publishing, verification, and trading converge

**Visual:** The Republic UI showing ResearchFeed + Market + Knowledge Graph

---

## Slide 3: The Research Feed
**Headline:** Twitter Meets arXiv — Real-Time Science
**Key points:**
- 4 feed item types, color-coded:
  - NEW LAUNCH (green): Paper title, author, market cap, verification status
  - AGENT REVIEW (purple): AI agent analysis with sentiment + impact score
  - MARKET MOVE (blue): Probability shifts with trend indicators
  - WARRIOR ALERT (red): Fraud detection findings
- Live updates every 10 seconds
- Shield badges for verified papers (CrossRef DOI check)

**Visual:** ResearchFeed screenshot

---

## Slide 4: Knowledge Graph as Social Discovery
**Headline:** Explore Science Like a Social Network
**Key points:**
- Interactive ForceGraph2D: 50+ papers as nodes, citations as edges
- Click a paper → see details, reviews, market price, agent analysis
- Field clustering, citation thresholds, time slider
- GNN link prediction: AI predicts undiscovered connections
- RAG chat: Ask questions, agent highlights/zooms/paths on graph

**Visual:** Knowledge Graph screenshot with paper nodes

---

## Slide 5: Paper2Agent — Papers Become Tools
**Headline:** Turn Any Paper into a Runnable AI Agent
**Key points:**
- 3-phase pipeline: Repo Discovery → Code Analysis → MCP Server Ready
- Linked to 15 real GitHub repos (BERT, GPT-2, LLaMA, Stable Diffusion)
- Auto-generates MCP tool definitions
- One-click `claude mcp add` command
- Papers aren't just readable — they're executable

**Visual:** Paper2Agent pipeline animation screenshot

---

## Slide 6: The Full Lifecycle
**Headline:** Launch → Verify → Price → Trade → Reward
**Key points:**
1. **Launch:** Submit paper ($50 USDC), verified via Flare FDC
2. **Verify:** AI agent swarm analyzes (TRiSM guardrails)
3. **Price:** LMSR prediction market auto-creates
4. **Trade:** Anyone can buy YES/NO shares
5. **Reward:** RESEARCH tokens for citations, replications
- Every step is on-chain, transparent, and incentive-aligned

**Visual:** Lifecycle flow diagram

---

## Slide 7: Why This is a New Consumer Primitive
**Headline:** At the Intersection of Everything
**Key points:**
- LLMs + Blockchain + Markets + Social = ???
- pump.fun showed: launching assets is a consumer primitive
- Polymarket showed: betting on outcomes is a consumer primitive
- The Republic shows: **launching knowledge and betting on truth** is the next one
- Every paper is a market. Every citation is a transaction. Every review is content.
- This is what X.com becomes for science.

**Visual:** Venn diagram: Social + AI + Finance + Science = The Republic

---

## Slide 8: The Vision
**Headline:** The Attention Economy Meets the Knowledge Economy
**Key points:**
- Phase 1: Research verification platform (NOW)
- Phase 2: Any knowledge claim can be launched, verified, and traded
- Phase 3: A parallel economy where truth is the currency
- 10 years ago nobody imagined pump.fun. Today nobody imagines science.fun.
- The Republic: where publishing is launching, reviewing is trading, and truth pays.
