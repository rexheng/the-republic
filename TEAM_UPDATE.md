# Team Update - Saturday Morning

## What's Done
- Smart contracts deployed to Flare Coston2 testnet
- Frontend live on Vercel with Papers, Submit, Review, Stats tabs
- Full local demo flow working

## What's Next: Interactive Knowledge Graph
We're adding an interactive knowledge graph visualization as the **new default tab**. This is the big demo feature.

### How it works
- **50+ real AI/ML papers** (Attention Is All You Need, BERT, GPT-4, ResNets, etc.) rendered as an interactive force-directed graph
- **Live Semantic Scholar API** pulls in more papers + citation links on search
- **On-chain papers overlay** in green so judges see blockchain integration visually
- Click any paper node → sidebar with details → "Import to Blockchain" button pre-fills the Submit form
- Search bar, citation filters, year range — the whole deal
- **Works offline** with bundled seed data (no CORS anxiety during demo)

### Tech
- `react-force-graph-2d` for visualization
- Semantic Scholar API (free, no auth)
- 4 new files, 4 modified files

### Implementation is planned and ready to go — just needs to be built.

## Feature Ideas We're Considering (after knowledge graph)

### Prediction Market on Paper Replication (high priority)
- "Will this paper replicate?" — binary market, users stake USDC
- Already have the token contracts for this
- "Polymarket for science" is a great pitch line

### Bayesian Confidence Scores
- Each paper gets a live confidence score based on citations + reviews + market price
- Displays on graph nodes — looks sophisticated, ~50 lines of code

### GNN Link Prediction (stretch goal)
- Train a small GNN to predict missing citation links
- Show "AI-predicted connections" as dashed lines on the graph
- Pre-compute offline, bundle results

### Paper2Agent (future roadmap)
- Auto-convert paper repos into MCP servers (callable tools)
- "We don't just index papers, we make them executable"
- Great for the roadmap slide, not this sprint

## Priority Order
1. Knowledge Graph (today)
2. Prediction Market (if time)
3. Confidence Scores (quick add)
4. GNN / Paper2Agent (mention in pitch)
