import React from 'react';

function Vision() {
  return (
    <div className="vision">
      {/* Hero */}
      <section className="vision-hero">
        <div className="vision-hero-badge">ETH Oxford 2026 // New Consumer Primitives</div>
        <h1 className="vision-hero-title">The Problem with Academic Publishing</h1>
        <p className="vision-hero-subtitle">
          A decentralized platform that connects discovery, evaluation, and execution of research
          &mdash; making science open, fair, and actionable.
        </p>
      </section>

      {/* The Problem */}
      <section className="vision-section">
        <h2 className="vision-section-title">Why This Matters</h2>
        <div className="vision-problem-grid">
          <div className="vision-problem-card">
            <span className="vision-problem-icon">&#9203;</span>
            <h3>Slow Review Cycles</h3>
            <p>Peer review takes months to years. Reviewers work for free with no accountability or incentive to be thorough.</p>
          </div>
          <div className="vision-problem-card">
            <span className="vision-problem-icon">&#128176;</span>
            <h3>No Reviewer Incentives</h3>
            <p>Reviewers donate thousands of hours with zero compensation, leading to declining quality and participation.</p>
          </div>
          <div className="vision-problem-card">
            <span className="vision-problem-icon">&#128200;</span>
            <h3>Citation Gaming</h3>
            <p>Impact factors and h-indices are easily gamed. Metrics reward quantity and self-citation over genuine contribution.</p>
          </div>
          <div className="vision-problem-card">
            <span className="vision-problem-icon">&#128187;</span>
            <h3>Papers != Runnable Code</h3>
            <p>Most published research can't be reproduced. Code is missing, environments are undocumented, results are unverifiable.</p>
          </div>
        </div>
      </section>

      {/* Our Vision */}
      <section className="vision-section">
        <h2 className="vision-section-title">Our Vision</h2>
        <p className="vision-description">
          Research Graph replaces the broken publish-or-perish pipeline with an open, incentive-aligned system.
          Every paper is discoverable, every review is rewarded, and every result is executable.
        </p>
        <div className="vision-pipeline">
          <div className="vision-pipeline-step">
            <div className="vision-pipeline-num">1</div>
            <div className="vision-pipeline-label">Discover</div>
            <div className="vision-pipeline-desc">Explore papers through an interactive knowledge graph with citation networks</div>
          </div>
          <div className="vision-pipeline-arrow">&rarr;</div>
          <div className="vision-pipeline-step">
            <div className="vision-pipeline-num">2</div>
            <div className="vision-pipeline-label">Evaluate</div>
            <div className="vision-pipeline-desc">Multi-dimensional review with Bayesian aggregation and on-chain incentives</div>
          </div>
          <div className="vision-pipeline-arrow">&rarr;</div>
          <div className="vision-pipeline-step">
            <div className="vision-pipeline-num">3</div>
            <div className="vision-pipeline-label">Execute</div>
            <div className="vision-pipeline-desc">Transform papers into runnable AI tools via Paper2Agent MCP servers</div>
          </div>
        </div>
      </section>

      {/* How It Works — 4 Pillars */}
      <section className="vision-section">
        <h2 className="vision-section-title">How It Works</h2>
        <div className="vision-pillars">
          <div className="vision-pillar">
            <div className="vision-pillar-icon">&#127760;</div>
            <h3>Knowledge Graph</h3>
            <p>
              Interactive force-directed graph of 50+ papers with citation networks.
              Search, filter by field, and explore connections. Click any node to see full metadata,
              abstracts, and Semantic Scholar data.
            </p>
          </div>
          <div className="vision-pillar">
            <div className="vision-pillar-icon">&#9939;</div>
            <h3>On-Chain Publishing</h3>
            <p>
              Submit papers with immutable IPFS-backed records on Flare. Transparent peer review
              with USDC payments via Plasma. Every submission, review, and citation is verifiable on-chain.
            </p>
          </div>
          <div className="vision-pillar">
            <div className="vision-pillar-icon">&#128202;</div>
            <h3>Enhanced Evaluation</h3>
            <p>
              Unjournal-inspired multi-dimensional scoring across 6 dimensions with 90% confidence intervals.
              Bayesian precision-weighted aggregation, replication probability prediction, and merit gap detection.
            </p>
          </div>
          <div className="vision-pillar">
            <div className="vision-pillar-icon">&#129302;</div>
            <h3>Paper2Agent</h3>
            <p>
              Transform any paper into callable AI tools. Discover the GitHub repo, analyze code structure,
              and generate an MCP server &mdash; making research directly executable from Claude or any MCP client.
            </p>
          </div>
        </div>
      </section>

      {/* Methodology */}
      <section className="vision-section">
        <h2 className="vision-section-title">Methodology &amp; Technical Details</h2>

        <div className="vision-methodology">
          <div className="vision-method-block">
            <h3>Evaluation System</h3>
            <div className="vision-method-content">
              <div className="vision-method-item">
                <strong>6 Dimensions:</strong> Overall Quality, Novelty, Methods Rigor, Data Transparency, Communication Clarity, Relevance
              </div>
              <div className="vision-method-item">
                <strong>Confidence Intervals:</strong> Each score includes a 90% CI (5th to 95th percentile), letting reviewers express uncertainty
              </div>
              <div className="vision-method-item">
                <strong>Bayesian Aggregation:</strong> Precision-weighted averaging across reviewers &mdash; narrower CIs (more confident reviewers) carry more weight
              </div>
              <div className="vision-method-item">
                <strong>Replication Prediction:</strong> Reviewers predict the probability (0-100%) that key results would replicate
              </div>
              <div className="vision-method-item">
                <strong>Merit Gap Detection:</strong> Dual journal tier system compares "should publish in" vs "will publish in" to surface undervalued research
              </div>
            </div>
          </div>

          <div className="vision-method-block">
            <h3>Blockchain Architecture</h3>
            <div className="vision-method-content">
              <div className="vision-method-item">
                <strong>Flare Network:</strong> Paper submissions and citation records stored on-chain. Flare Data Connector (FDC) verifies external data like citation counts and DOIs
              </div>
              <div className="vision-method-item">
                <strong>Plasma Network:</strong> Fast, low-cost USDC payments for reviewer compensation. Instant settlement for peer review rewards
              </div>
              <div className="vision-method-item">
                <strong>Smart Contracts:</strong> ResearchGraph.sol manages paper lifecycle (submit, review, accept/reject). ERC-20 research tokens for citation-based rewards
              </div>
            </div>
          </div>

          <div className="vision-method-block">
            <h3>Paper2Agent Pipeline</h3>
            <div className="vision-method-content">
              <div className="vision-method-item">
                <strong>Phase 1 &mdash; Repo Discovery:</strong> Matches papers to GitHub repositories using bundled metadata for 15 landmark papers (BERT, GPT-2, LLaMA, Stable Diffusion, etc.)
              </div>
              <div className="vision-method-item">
                <strong>Phase 2 &mdash; Code Analysis:</strong> Analyzes repository structure, identifies entry points, models, configs, and key dependencies
              </div>
              <div className="vision-method-item">
                <strong>Phase 3 &mdash; MCP Server:</strong> Generates Model Context Protocol tool definitions with typed parameters, making research code callable from AI assistants
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture */}
      <section className="vision-section">
        <h2 className="vision-section-title">Architecture</h2>
        <div className="vision-stack">
          <div className="vision-stack-layer vision-stack-frontend">
            <div className="vision-stack-label">Frontend</div>
            <div className="vision-stack-tech">React + ForceGraph2D + Canvas</div>
            <div className="vision-stack-items">Knowledge Graph, Paper2Agent, Enhanced Review UI, Evaluation Display</div>
          </div>
          <div className="vision-stack-connector">&#8595;</div>
          <div className="vision-stack-layer vision-stack-contracts">
            <div className="vision-stack-label">Smart Contracts</div>
            <div className="vision-stack-tech">Solidity + Ethers.js</div>
            <div className="vision-stack-items">ResearchGraph.sol, ERC-20 Tokens, USDC Integration</div>
          </div>
          <div className="vision-stack-connector">&#8595;</div>
          <div className="vision-stack-layer vision-stack-infra">
            <div className="vision-stack-label">Infrastructure</div>
            <div className="vision-stack-tech">Flare Testnet + Plasma Testnet</div>
            <div className="vision-stack-items">IPFS (paper storage), Semantic Scholar API, Flare Data Connector</div>
          </div>
        </div>
      </section>

      {/* Built At */}
      <section className="vision-built-at">
        <div className="vision-built-badge">
          <div className="vision-built-event">Built at ETH Oxford 2026</div>
          <div className="vision-built-track">Track: New Consumer Primitives</div>
          <div className="vision-built-chains">Powered by Flare &amp; Plasma</div>
        </div>
      </section>
    </div>
  );
}

export default Vision;
