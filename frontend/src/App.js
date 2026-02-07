import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS, NETWORKS, ABIS } from './config';
import SubmitPaper from './components/SubmitPaper';
import PaperList from './components/PaperList';
import ReviewPanel from './components/ReviewPanel';
import Stats from './components/Stats';
import NetworkCheck from './components/NetworkCheck';
import KnowledgeGraph from './components/KnowledgeGraph';
import Paper2Agent from './components/Paper2Agent';
import PredictionMarket from './components/PredictionMarket';
import AIResearchLab from './components/AIResearchLab';
import Vision from './components/Vision';
import './App.css';

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contracts, setContracts] = useState({});
  const [activeTab, setActiveTab] = useState('graph');
  const [loading, setLoading] = useState(false);
  const [importData, setImportData] = useState(null);
  const [agentPaper, setAgentPaper] = useState(null);
  const [labPaper, setLabPaper] = useState(null);

  const handleImportPaper = useCallback((paperData) => {
    setImportData(paperData);
    setActiveTab('submit');
  }, []);

  const handleMakeRunnable = useCallback((paper) => {
    setAgentPaper(paper);
    setActiveTab('agent');
  }, []);

  const handleReplicate = useCallback((paper) => {
    setLabPaper(paper);
    setActiveTab('lab');
  }, []);

  useEffect(() => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);
    }
  }, []);

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      await provider.send('eth_requestAccounts', []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setAccount(address);
      setSigner(signer);

      // Initialize contracts
      const researchGraph = new ethers.Contract(
        CONTRACTS.RESEARCH_GRAPH,
        ABIS.RESEARCH_GRAPH,
        signer
      );
      const usdc = new ethers.Contract(
        CONTRACTS.USDC,
        ABIS.ERC20,
        signer
      );
      const researchToken = new ethers.Contract(
        CONTRACTS.RESEARCH_TOKEN,
        ABIS.ERC20,
        signer
      );

      const predictionMarket = new ethers.Contract(
        CONTRACTS.PREDICTION_MARKET,
        ABIS.PREDICTION_MARKET,
        signer
      );

      setContracts({ researchGraph, usdc, researchToken, predictionMarket });
      setLoading(false);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setLoading(false);
      alert('Failed to connect wallet');
    }
  };

  const switchNetwork = async (networkKey) => {
    const network = NETWORKS[networkKey];
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: network.chainId }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [network],
          });
        } catch (addError) {
          console.error('Error adding network:', addError);
        }
      }
    }
  };

  return (
    <div className="App">
      <NetworkCheck provider={provider} />
      <header className="header">
        <div className="container">
          <div className="header-content">
            <h1>🔬 Research Graph</h1>
            <p className="subtitle">Decentralized Knowledge • Fair Incentives • Open Science</p>
          </div>
          <div className="header-actions">
            {!account ? (
              <button className="btn btn-primary" onClick={connectWallet} disabled={loading}>
                {loading ? 'Connecting...' : 'Connect Wallet'}
              </button>
            ) : (
              <div className="account-info">
                <span className="account-badge">
                  {account.slice(0, 6)}...{account.slice(-4)}
                </span>
                <div className="network-switcher">
                  <button
                    className="btn btn-small"
                    onClick={() => switchNetwork('FLARE_TESTNET')}
                  >
                    Flare
                  </button>
                  <button
                    className="btn btn-small"
                    onClick={() => switchNetwork('PLASMA_TESTNET')}
                  >
                    Plasma
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        <div className="container">
          {!account ? (
            <div className="welcome-card">
              <h2>Welcome to the Future of Research</h2>
              <div className="features">
                <div className="feature">
                  <span className="icon">💰</span>
                  <h3>Get Paid for Reviews</h3>
                  <p>Earn USDC via Plasma for quality peer reviews</p>
                </div>
                <div className="feature">
                  <span className="icon">🔗</span>
                  <h3>Citations = Rewards</h3>
                  <p>Earn tokens when your research is cited</p>
                </div>
                <div className="feature">
                  <span className="icon">🌐</span>
                  <h3>Verified Data</h3>
                  <p>External verification via Flare Data Connector</p>
                </div>
                <div className="feature">
                  <span className="icon">🔒</span>
                  <h3>On-Chain Proof</h3>
                  <p>Immutable research record on blockchain</p>
                </div>
              </div>
              <button className="btn btn-large" onClick={connectWallet}>
                Connect Wallet to Get Started
              </button>
            </div>
          ) : (
            <>
              <div className="tabs">
                <button
                  className={`tab ${activeTab === 'vision' ? 'active' : ''}`}
                  onClick={() => setActiveTab('vision')}
                >
                  Vision
                </button>
                <button
                  className={`tab ${activeTab === 'graph' ? 'active' : ''}`}
                  onClick={() => setActiveTab('graph')}
                >
                  Knowledge Graph
                </button>
                <button
                  className={`tab ${activeTab === 'papers' ? 'active' : ''}`}
                  onClick={() => setActiveTab('papers')}
                >
                  Papers
                </button>
                <button
                  className={`tab ${activeTab === 'submit' ? 'active' : ''}`}
                  onClick={() => setActiveTab('submit')}
                >
                  ➕ Submit Paper
                </button>
                <button
                  className={`tab ${activeTab === 'review' ? 'active' : ''}`}
                  onClick={() => setActiveTab('review')}
                >
                  ✍️ Review
                </button>
                <button
                  className={`tab ${activeTab === 'predict' ? 'active' : ''}`}
                  onClick={() => setActiveTab('predict')}
                >
                  Predict
                </button>
                <button
                  className={`tab ${activeTab === 'agent' ? 'active' : ''}`}
                  onClick={() => setActiveTab('agent')}
                >
                  Paper2Agent
                </button>
                <button
                  className={`tab ${activeTab === 'lab' ? 'active' : ''}`}
                  onClick={() => setActiveTab('lab')}
                >
                  AI Lab
                </button>
                <button
                  className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
                  onClick={() => setActiveTab('stats')}
                >
                  Stats
                </button>
              </div>

              <div className={`tab-content ${activeTab === 'graph' ? 'tab-content-graph' : ''}`}>
                {activeTab === 'vision' && (
                  <Vision />
                )}
                {activeTab === 'graph' && (
                  <KnowledgeGraph contracts={contracts} account={account} onImportPaper={handleImportPaper} onMakeRunnable={handleMakeRunnable} onReplicate={handleReplicate} />
                )}
                {activeTab === 'papers' && (
                  <PaperList contracts={contracts} account={account} />
                )}
                {activeTab === 'submit' && (
                  <SubmitPaper contracts={contracts} account={account} importData={importData} />
                )}
                {activeTab === 'review' && (
                  <ReviewPanel contracts={contracts} account={account} />
                )}
                {activeTab === 'predict' && (
                  <PredictionMarket contracts={contracts} account={account} />
                )}
                {activeTab === 'agent' && (
                  <Paper2Agent agentPaper={agentPaper} />
                )}
                {activeTab === 'lab' && (
                  <AIResearchLab labPaper={labPaper} />
                )}
                {activeTab === 'stats' && (
                  <Stats contracts={contracts} account={account} />
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="footer">
        <div className="container">
          <p>Built at ETH Oxford 2026 • Powered by Flare & Plasma</p>
          <div className="links">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <span>•</span>
            <a href="#docs">Docs</a>
            <span>•</span>
            <a href="#whitepaper">Whitepaper</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
