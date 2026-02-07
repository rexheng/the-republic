# Changelog

## v4.0-paper2agent (2026-02-07)

**Paper2Agent: From Research to Runnable AI Agent**

Transform research papers into executable MCP (Model Context Protocol) servers with callable tools. Bridges the gap between paper discovery and code execution.

### Key Features
- 3-phase animated pipeline: Repository Discovery, Code Analysis, MCP Server Ready
- 15 seed papers linked to real GitHub repositories (BERT, GPT-2, LLaMA, Stable Diffusion, ResNet, etc.)
- Pre-computed MCP tool definitions per repo (3-5 tools each)
- Copy-to-clipboard `claude mcp add` command for instant connection
- Paper picker dropdown with all repo-linked papers
- "Make Runnable" button in Knowledge Graph paper sidebar
- Code indicator `{ }` on graph nodes with linked repositories
- Full MCP server configuration JSON display
- Expandable tool cards with parameter schemas and example calls

### Files Added
- `src/utils/repoData.js` — Bundled repo metadata + MCP tool definitions for 15 papers
- `src/components/Paper2Agent.js` — Main 3-phase pipeline component
- `src/components/ToolCard.js` — Reusable MCP tool display card

### Files Modified
- `src/utils/seedData.js` — Added `githubRepo` field to 15 seed papers
- `src/components/PaperDetail.js` — Added "Make Runnable" button
- `src/components/KnowledgeGraph.js` — Added code node indicator + onMakeRunnable callback
- `src/App.js` — Added Paper2Agent tab + agentPaper state wiring
- `src/App.css` — Added Paper2Agent pipeline styles, tool cards, animations

### Inspiration
- [Paper2Agent](https://github.com/paper2agent) — Converts paper GitHub repos into MCP servers
- Model Context Protocol (MCP) — Open standard for AI tool integration

---

## v3.0-evaluation (2026-02-07)

**Enhanced Evaluation System inspired by The Unjournal**

A multi-dimensional review system with Bayesian aggregation, confidence intervals, and replication prediction.

### Key Features
- 6 evaluation dimensions: Overall, Methodology, Novelty, Writing, Reproducibility, Impact
- 90% confidence intervals (lower/upper bounds per dimension)
- Bayesian precision-weighted aggregation across multiple reviewers
- Replication probability prediction (0-100%)
- Dual journal tier system: "should publish" vs "will publish" (merit gap detection)
- Canvas radar chart visualization
- Compact and full display modes
- Demo data: 3 reviewers on "Attention Is All You Need"

### Files Added
- `src/components/EnhancedReview.js` — Review submission with sliders + CI bounds
- `src/components/EvaluationDisplay.js` — Aggregated evaluation display (compact + full)
- `src/components/RadarChart.js` — Canvas-based radar chart

### Files Modified
- `src/components/ReviewPanel.js` — Integrated EnhancedReview
- `src/components/PaperDetail.js` — Added evaluation summary section
- `src/App.css` — Added evaluation and review system styles

### Inspiration
- [The Unjournal](https://unjournal.org) — Open evaluation platform for research
- Bayesian meta-analysis methodology for aggregating reviewer scores

---

## v2.0-knowledge-graph (2026-02-06)

**Interactive Knowledge Graph with Semantic Scholar Integration**

A force-directed graph of 50 seed papers with search and filtering capabilities.

### Key Features
- ForceGraph2D interactive visualization with 50 landmark AI/ML papers
- 80+ citation relationships forming visible research lineages
- Semantic Scholar API integration with live paper search
- Paper detail sidebar with metadata, abstract, and import flow
- Filtering by source type, citation count, and year range
- Color-coded nodes: External (blue), On-Chain (green), User (gold)
- CORS fallback strategy: bundled seed data + live API + proxy

### Files Added
- `src/utils/seedData.js` — 50 seed papers + citation relationships
- `src/utils/semanticScholar.js` — API client with search + graph building
- `src/components/KnowledgeGraph.js` — Force graph + search + filters
- `src/components/PaperDetail.js` — Paper sidebar with metadata + import

### Files Modified
- `src/App.js` — Added Knowledge Graph as default tab
- `src/App.css` — Added graph, sidebar, search, filter styles
- `src/config.js` — Added Semantic Scholar API config + graph colors

---

## v1.0-base (2026-02-06)

**Decentralized Research Graph — Core Blockchain Platform**

Smart contract-based paper submission, peer review, and citation tracking on Flare and Plasma testnets.

### Key Features
- Paper submission with IPFS hash and DOI
- On-chain peer review with USDC rewards (via Plasma)
- Citation tracking with token rewards
- Flare Data Connector for external data verification
- MetaMask wallet integration with network switching
- Paper list, submission form, review panel, and stats dashboard

### Files Added
- `src/App.js` — Main application with wallet connection + tab navigation
- `src/config.js` — Contract addresses, ABIs, network configs
- `src/components/SubmitPaper.js` — Paper submission form
- `src/components/PaperList.js` — On-chain paper browser
- `src/components/ReviewPanel.js` — Peer review interface
- `src/components/Stats.js` — Platform statistics dashboard
- `src/components/NetworkCheck.js` — Network detection + switching
- `contracts/ResearchGraph.sol` — Main smart contract

### Stack
- React + ethers.js frontend
- Solidity smart contracts (Flare & Plasma testnets)
- IPFS for paper storage
- Built at ETH Oxford 2026
