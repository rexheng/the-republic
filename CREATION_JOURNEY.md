# 📜 The Creation of The Republic: Development Journey

This document chronicles the birth and evolution of **The Republic** — a decentralized research verification platform built during the **ETH Oxford 2026 Hackathon**.

---

## 📅 Timeline: February 6-8, 2026

### **Phase 1: The Foundation (Friday Night)**
The project started with a vision to solve the "Replication Crisis" and the $2B unpaid peer-review problem.
*   **Initial Commit:** Scaffolded the Decentralized Research Graph.
*   **Smart Contracts:** Developed `ResearchGraph.sol` and `ResearchToken.sol` to handle on-chain paper submissions and citation rewards.
*   **Integration:** Wired up Flare Protocols (FTSO for pricing, RNG for reviewer selection, and FDC for external data verification).
*   **First Deployment:** Successfully deployed to Flare Coston2 Testnet.

### **Phase 2: The Visual Awakening (Saturday Morning)**
The goal was to make complex academic data intuitive and interactive.
*   **Interactive Knowledge Graph:** Implemented a Force-Directed Graph using D3.js, seeded with 50+ landmark AI/ML papers.
*   **Evaluation System:** Added a multi-dimensional scoring system inspired by *The Unjournal*, moving beyond simple "accept/reject" to nuanced metrics like replicability and impact.

### **Phase 3: The AI & ML Pivot (Saturday Afternoon)**
Recognizing that research is increasingly driven by agents, we built "The Republic Engine."
*   **Kaggle Lab:** Created a paper-driven AI agent pipeline that downloads Kaggle datasets and automatically generates ML models based on research techniques.
*   **Agent Gateway:** Built a unified interface for AI providers (Claude, Gemini), allowing specialized "Agent Castes" (Philosophers, Warriors, Artisans) to analyze papers.

### **Phase 4: The Convergence (Saturday Night)**
The final architectural pieces were put into place to create a "Consumer Primitive."
*   **Dual-Chain Architecture:** Integrated **Plasma** for instant USDC settlements and micropayments alongside the **Flare** verification layer.
*   **The Republic Engine:** Developed an autonomous loop where AI agents browse the graph, identify anomalies (warriors), and price truth through prediction markets (artisans).
*   **Gemini Integration:** Successfully integrated Gemini 1.5/2.5 Pro as the primary brain for the Republic's agent castes.

---

## 🏗️ Architectural Pillars

### 1. **Blockchain Layer (Flare + Plasma)**
*   **Flare:** Acts as the "Supreme Court" and "Library," handling data verification (FDC), random assignment (RNG), and pricing (FTSO).
*   **Plasma:** Acts as the "Commercial District," handling fast, cheap USDC payments for reviewers and researchers.

### 2. **Intelligence Layer (Agent Swarm)**
*   **Philosopher Kings (Iris/Sage):** Deep literature analysis and critical review.
*   **Warriors (Atlas):** Fraud detection and forensic scanning.
*   **Artisans (Tensor/Hermes):** Computational realism and market pricing.

### 3. **Data Layer (Knowledge Graph)**
*   A living network of papers, citations, and causal links.
*   Powered by a custom Node.js backend with Python workers for heavy ML tasks.

---

## 🛠️ Key Technologies Used

| Layer | Technology |
| :--- | :--- |
| **Smart Contracts** | Solidity, Hardhat, OpenZeppelin |
| **Networks** | Flare (Coston2), Plasma (Testnet) |
| **AI / LLMs** | Google Gemini 2.5, Claude 3.5 Sonnet |
| **Backend** | Node.js, Express, WebSocket, Python |
| **Data Science** | Pandas, Scikit-learn, Kaggle API |
| **Frontend** | React, D3.js, Tailwind CSS, Ethers.js |

---

## 💡 Philosophy
*   **Truth over Authority:** We replace the prestige of journals with the verification of code and math.
*   **Fair Compensation:** Researchers and reviewers are part of a creator economy, not a volunteer labor force.
*   **Transparent Science:** Every citation and replication attempt is a verifiable event on the graph.

---

*Built with passion at ETH Oxford 2026.* 🚀
