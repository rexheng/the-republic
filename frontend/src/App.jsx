import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ChevronDown, ExternalLink, Plus } from 'lucide-react';
import { CONTRACTS, NETWORKS, ABIS } from './config';
import { loadInitialGraph } from './utils/semanticScholar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import SubmitPaper from './components/SubmitPaper';
import NetworkCheck from './components/NetworkCheck';
import KnowledgeGraph from './components/KnowledgeGraph';
import Paper2Agent from './components/Paper2Agent';
import PredictionMarket from './components/PredictionMarket';
import AIResearchLab from './components/AIResearchLab';
import Vision from './components/Vision';
import KaggleLab from './components/KaggleLab';
import ResearchFeed from './components/ResearchFeed';

// Track-focused mode: ?track=defi | ?track=ai | ?track=consumer | (none = full)
const TRACK_CONFIG = {
  defi: {
    label: 'Prediction Markets + DeFi',
    subtitle: 'LMSR Truth Discovery for Science',
    defaultTab: 'predict',
    tabs: ['graph', 'predict', 'feed'],
    color: '#10b981', // emerald
  },
  ai: {
    label: 'AI Middleware & Application',
    subtitle: 'Autonomous Agent Swarms with TRiSM Guardrails',
    defaultTab: 'lab',
    tabs: ['graph', 'lab', 'kaggle', 'feed'],
    color: '#8b5cf6', // violet
  },
  consumer: {
    label: 'New Consumer Primitives',
    subtitle: 'Reimagining Academic Publishing',
    defaultTab: 'feed',
    tabs: ['graph', 'feed', 'agent', 'predict'],
    color: '#f59e0b', // amber
  },
};

function App() {
  const [account, setAccount] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contracts, setContracts] = useState({});
  const [loading, setLoading] = useState(false);
  const [importData, setImportData] = useState(null);
  const [agentPaper, setAgentPaper] = useState(null);
  const [labPaper, setLabPaper] = useState(null);

  // Graph data — lifted here so it persists across tab switches
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const graphLoaded = useRef(false);

  useEffect(() => {
    if (graphLoaded.current) return;
    graphLoaded.current = true;
    loadInitialGraph().then(data => setGraphData(data));
  }, []);

  // Track mode from URL
  const urlParams = new URLSearchParams(window.location.search);
  const trackMode = urlParams.get('track'); // 'defi' | 'ai' | 'consumer' | null
  const trackConfig = trackMode ? TRACK_CONFIG[trackMode] : null;

  const [activeTab, setActiveTab] = useState(trackConfig?.defaultTab || 'graph');

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

      const researchGraph = new ethers.Contract(CONTRACTS.RESEARCH_GRAPH, ABIS.RESEARCH_GRAPH, signer);
      const usdc = new ethers.Contract(CONTRACTS.USDC, ABIS.ERC20, signer);
      const researchToken = new ethers.Contract(CONTRACTS.RESEARCH_TOKEN, ABIS.ERC20, signer);
      const predictionMarket = new ethers.Contract(CONTRACTS.PREDICTION_MARKET, ABIS.PREDICTION_MARKET, signer);

      setContracts({ researchGraph, usdc, researchToken, predictionMarket });
      setLoading(false);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setLoading(false);
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
    <div className="min-h-screen bg-white text-neutral-900 font-sans">
      <NetworkCheck provider={provider} />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 px-6 md:px-12 py-4 flex justify-between items-center bg-white/90 backdrop-blur-sm border-b border-neutral-100">
        <div className="flex items-center gap-6">
          <div className="font-mono font-bold tracking-tighter text-xl">
            THE REPUBLIC
          </div>
          {account && (
            <button
              onClick={() => setActiveTab('vision')}
              className={`font-mono text-[10px] uppercase tracking-widest transition-colors hidden md:block ${
                activeTab === 'vision' ? 'text-neutral-900 font-bold' : 'text-neutral-400 hover:text-neutral-900'
              }`}
            >
              About
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {trackConfig && (
            <a
              href="/"
              className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 hover:text-neutral-900 transition-colors hidden md:block"
            >
              All Tracks
            </a>
          )}
          {account && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-neutral-300 text-neutral-600 hover:bg-neutral-900 hover:text-white hover:border-neutral-900 transition-colors"
              onClick={() => setActiveTab('submit')}
              title="Submit Paper"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {!account ? (
            <Button
              variant="outline"
              className="border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white font-mono text-xs uppercase tracking-widest"
              onClick={connectWallet}
              disabled={loading}
            >
              <Wallet className="h-4 w-4" />
              {loading ? 'Connecting...' : 'Connect'}
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono text-[10px]">
                {account.slice(0, 6)}...{account.slice(-4)}
              </Badge>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-900"
                  onClick={() => switchNetwork('FLARE_TESTNET')}
                >
                  Flare
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-900"
                  onClick={() => switchNetwork('PLASMA_TESTNET')}
                >
                  Plasma
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-[72px] min-h-screen">
        {!account ? (
          /* Landing / Connect */
          <div className="max-w-7xl mx-auto px-6 md:px-12">
            <section className="py-24 md:py-32 border-b border-neutral-100">
              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="text-5xl md:text-7xl lg:text-8xl tracking-tight leading-[1.1] mb-8 max-w-4xl"
              >
                The Republic: <br />
                <span className="italic text-neutral-400">
                  {trackConfig ? trackConfig.subtitle : 'Decentralised Research.'}
                </span>
              </motion.h1>
              {trackConfig && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="mb-6"
                >
                  <span
                    className="inline-block font-mono text-[10px] uppercase tracking-widest px-3 py-1 rounded-full text-white"
                    style={{ backgroundColor: trackConfig.color }}
                  >
                    ETH Oxford 2026 — {trackConfig.label}
                  </span>
                </motion.div>
              )}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="max-w-xl"
              >
                <p className="text-lg font-light text-neutral-600 leading-relaxed mb-8">
                  {trackMode === 'defi' && 'LMSR prediction markets that price scientific truth. Bet on whether a paper will replicate. Dual-chain architecture: Flare oracles verify data, Plasma settles USDC payments. The Bloomberg Terminal for science.'}
                  {trackMode === 'ai' && 'Three autonomous AI agent castes — Philosophers, Warriors, Artisans — verify science at scale. TRiSM guardrails (hallucination detection, drift monitoring, circuit breakers) make them commercially deployable. The first AI civilization with built-in accountability.'}
                  {trackMode === 'consumer' && 'Academic publishing reimagined as a consumer experience. Papers launched like tokens, verified by AI swarms, priced by prediction markets. The attention economy meets the knowledge economy. pump.fun for science.'}
                  {!trackMode && 'A Plato-inspired ecosystem where AI agent castes and human researchers collaborate to discover, evaluate, and verify science. Dual-chain architecture on Flare and Plasma. LMSR prediction markets. Linguistic forensics. TRiSM-guarded autonomous agents.'}
                </p>
                <Button
                  className="bg-neutral-900 text-white hover:bg-neutral-800 font-mono text-xs uppercase tracking-widest px-8 h-12"
                  onClick={connectWallet}
                  disabled={loading}
                >
                  <Wallet className="h-4 w-4" />
                  Enter The Republic
                </Button>
              </motion.div>
            </section>

            {!trackConfig ? (
              /* Full mode: show all 3 tracks */
              <section className="py-24 grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { label: 'Knowledge Exchange', icon: '📈', desc: 'Main Track: DeFi. LMSR-based prediction markets to price research truth and fund replication attempts trustlessly.', track: 'defi' },
                  { label: 'Agent Swarm', icon: '🤖', desc: 'Main Track: AI Application. Specialized agent castes reason over the graph with robust TRiSM guardrails and cross-chain verification.', track: 'ai' },
                  { label: 'Science Primitive', icon: '🧬', desc: 'Main Track: New Primitives. A research creator economy where papers are launched, verified, and cited as liquid assets.', track: 'consumer' },
                ].map((item, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.1, duration: 0.6 }}
                    className="border border-neutral-100 p-6 hover:border-neutral-900 transition-colors group cursor-pointer"
                    onClick={() => { window.location.search = `?track=${item.track}`; }}
                  >
                    <span className="text-3xl block mb-3">{item.icon}</span>
                    <h4 className="font-mono text-xs uppercase tracking-widest mb-3 text-neutral-900">
                      {item.label}
                    </h4>
                    <p className="text-neutral-600 font-light text-sm leading-relaxed">
                      {item.desc}
                    </p>
                    <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 mt-3 block group-hover:text-neutral-900 transition-colors">
                      View Demo →
                    </span>
                  </motion.div>
                ))}
              </section>
            ) : (
              /* Track mode: show key features for this track */
              <section className="py-24">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {trackMode === 'defi' && [
                    { label: 'LMSR Markets', stat: '$50', desc: 'Submit a paper for $50 USDC. An LMSR market auto-creates: will it replicate?' },
                    { label: 'Dual-Chain', stat: '2', desc: 'Flare (verification oracles) + Plasma (USDC settlement). Cross-chain bridge.' },
                    { label: 'Token Economy', stat: '3', desc: 'RESEARCH token for citations & replications. USDC for submissions & reviews.' },
                  ].map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.1 }}
                      className="border border-neutral-100 p-6">
                      <span className="text-3xl font-bold block mb-2" style={{ color: trackConfig.color }}>{item.stat}</span>
                      <h4 className="font-mono text-xs uppercase tracking-widest mb-2">{item.label}</h4>
                      <p className="text-neutral-600 font-light text-sm">{item.desc}</p>
                    </motion.div>
                  ))}
                  {trackMode === 'ai' && [
                    { label: 'Agent Castes', stat: '3', desc: 'Philosophers reason, Warriors verify with forensics, Artisans price via markets.' },
                    { label: 'TRiSM Guardrails', stat: '1402', desc: 'Safety interventions. Hallucination detection, drift monitoring, circuit breakers.' },
                    { label: 'Autonomous Loop', stat: '5s', desc: 'RepublicEngine heartbeat. Agents act independently, broadcast via WebSocket.' },
                  ].map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.1 }}
                      className="border border-neutral-100 p-6">
                      <span className="text-3xl font-bold block mb-2" style={{ color: trackConfig.color }}>{item.stat}</span>
                      <h4 className="font-mono text-xs uppercase tracking-widest mb-2">{item.label}</h4>
                      <p className="text-neutral-600 font-light text-sm">{item.desc}</p>
                    </motion.div>
                  ))}
                  {trackMode === 'consumer' && [
                    { label: 'Live Feed', stat: '∞', desc: 'Real-time stream of paper launches, agent reviews, market moves, and alerts.' },
                    { label: 'Knowledge Graph', stat: '50+', desc: 'Interactive ForceGraph2D. Explore citations, fields, and AI-predicted connections.' },
                    { label: 'Paper2Agent', stat: 'MCP', desc: 'Turn any paper into runnable AI tools via Model Context Protocol servers.' },
                  ].map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 + i * 0.1 }}
                      className="border border-neutral-100 p-6">
                      <span className="text-3xl font-bold block mb-2" style={{ color: trackConfig.color }}>{item.stat}</span>
                      <h4 className="font-mono text-xs uppercase tracking-widest mb-2">{item.label}</h4>
                      <p className="text-neutral-600 font-light text-sm">{item.desc}</p>
                    </motion.div>
                  ))}
                </div>
              </section>
            )}
          </div>
        ) : (
          /* Authenticated View */
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-neutral-200 bg-white sticky top-[72px] z-40">
              <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center overflow-x-auto no-scrollbar">
                {trackConfig && (
                  <div className="flex items-center gap-2 mr-4 py-2 flex-shrink-0">
                    <span
                      className="inline-block w-2 h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: trackConfig.color }}
                    />
                    <span className="font-mono text-[10px] uppercase tracking-widest font-bold" style={{ color: trackConfig.color }}>
                      {trackConfig.label}
                    </span>
                  </div>
                )}
                <TabsList className="border-b-0 py-2">
                  {(!trackConfig) ? (
                    <>
                      <TabsTrigger value="graph">Network</TabsTrigger>
                      <TabsTrigger value="lab">AI Lab</TabsTrigger>
                      <TabsTrigger value="predict">Markets</TabsTrigger>
                      <TabsTrigger value="kaggle">Kaggle</TabsTrigger>
                      <TabsTrigger value="agent">Paper2Agent</TabsTrigger>
                      <TabsTrigger value="feed">Live Feed</TabsTrigger>
                    </>
                  ) : (
                    <>
                      {trackConfig.tabs.includes('graph') && <TabsTrigger value="graph">Network</TabsTrigger>}
                      {trackConfig.tabs.includes('lab') && <TabsTrigger value="lab">AI Lab</TabsTrigger>}
                      {trackConfig.tabs.includes('predict') && <TabsTrigger value="predict">Markets</TabsTrigger>}
                      {trackConfig.tabs.includes('kaggle') && <TabsTrigger value="kaggle">Kaggle</TabsTrigger>}
                      {trackConfig.tabs.includes('agent') && <TabsTrigger value="agent">Paper2Agent</TabsTrigger>}
                      {trackConfig.tabs.includes('feed') && <TabsTrigger value="feed">Live Feed</TabsTrigger>}
                    </>
                  )}
                </TabsList>
              </div>
            </div>

            <div className={activeTab === 'graph' ? '' : 'max-w-7xl mx-auto px-6 md:px-12 py-8'}>
              <TabsContent value="vision">
                <Vision />
              </TabsContent>
              <TabsContent value="graph">
                <KnowledgeGraph
                  contracts={contracts}
                  account={account}
                  graphData={graphData}
                  setGraphData={setGraphData}
                  onImportPaper={handleImportPaper}
                  onMakeRunnable={handleMakeRunnable}
                  onReplicate={handleReplicate}
                />
              </TabsContent>
              <TabsContent value="submit">
                <SubmitPaper contracts={contracts} account={account} importData={importData} />
              </TabsContent>
              <TabsContent value="predict">
                <PredictionMarket contracts={contracts} account={account} />
              </TabsContent>
              <TabsContent value="agent">
                <Paper2Agent agentPaper={agentPaper} />
              </TabsContent>
              <TabsContent value="lab">
                <AIResearchLab labPaper={labPaper} />
              </TabsContent>
              <TabsContent value="kaggle">
                <KaggleLab />
              </TabsContent>
              <TabsContent value="feed">
                <ResearchFeed />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-neutral-900 text-white py-16 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start">
          <div>
            <div className="font-mono font-bold tracking-tighter text-xl mb-4">
              THE REPUBLIC
            </div>
            <p className="text-neutral-500 font-light text-sm max-w-sm">
              Built at ETH Oxford 2026. Powered by Flare and Plasma networks.
              Plato-inspired decentralised research verification.
            </p>
          </div>
          <div className="mt-8 md:mt-0 font-mono text-xs text-neutral-500 grid grid-cols-2 gap-8">
            <div>
              <h5 className="text-white mb-3 uppercase tracking-widest">Protocol</h5>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors mb-1">
                GitHub
              </a>
              <span className="block mb-1">Documentation</span>
              <span className="block">Whitepaper</span>
            </div>
            <div>
              <h5 className="text-white mb-3 uppercase tracking-widest">Networks</h5>
              <span className="block mb-1">Human Chain (Flare)</span>
              <span className="block">AI Chain (Plasma)</span>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-6 border-t border-neutral-800 flex justify-between items-end font-mono text-xs text-neutral-600">
          <p>&copy; 2026 The Republic</p>
          <p>ETH Oxford</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
