import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet, ChevronDown, ExternalLink, Plus, LogOut, User as UserIcon, Settings } from 'lucide-react';
import { CONTRACTS, NETWORKS, ABIS, PRIVY_APP_ID, BACKEND_URL } from './config';
import { loadInitialGraph } from './utils/semanticScholar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import SubmitPaper from './components/SubmitPaper';
import NetworkCheck from './components/NetworkCheck';
import KnowledgeGraph from './components/KnowledgeGraph';
import Paper2Agent from './components/Paper2Agent';
import PredictionMarket from './components/PredictionMarket';
import AIResearchLab from './components/AIResearchLab';
import Vision from './components/Vision';
import KaggleLab from './components/KaggleLab';
import ResearchFeed from './components/ResearchFeed';
import TabErrorBoundary from './components/TabErrorBoundary';
import ApiKeySettings from './components/ApiKeySettings';
import { hasStoredApiKey } from './utils/llm';

// Whether Privy is configured (PrivyProvider wraps App in index.jsx when true)
const PRIVY_ENABLED = !!PRIVY_APP_ID;

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

function AppCore({ privyState = null, privyWallets = [] }) {
  // ─── Auth state ───────────────────────────────────────────────
  // privyState and privyWallets are injected by AppWithPrivy wrapper
  // when Privy is configured; otherwise they default to null/[].

  // Fallback MetaMask-only state (used when Privy is not configured)
  const [fallbackAccount, setFallbackAccount] = useState(null);
  const [fallbackProvider, setFallbackProvider] = useState(null);

  // Shared state
  const [signer, setSigner] = useState(null);
  const [contracts, setContracts] = useState({});
  const [loading, setLoading] = useState(false);
  const [importData, setImportData] = useState(null);
  const [agentPaper, setAgentPaper] = useState(null);
  const [labPaper, setLabPaper] = useState(null);
  const [hideSubNav, setHideSubNav] = useState(false);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [keyConfigured, setKeyConfigured] = useState(() => hasStoredApiKey());

  // Allow child components to open settings via custom event
  useEffect(() => {
    const handler = () => setShowApiSettings(true);
    window.addEventListener('open-api-settings', handler);
    return () => window.removeEventListener('open-api-settings', handler);
  }, []);

  const handleCloseApiSettings = useCallback(() => {
    setShowApiSettings(false);
    setKeyConfigured(hasStoredApiKey());
  }, []);

  // Derive unified auth values
  const privyReady = privyState?.ready ?? true;
  const privyAuthenticated = PRIVY_ENABLED && (privyState?.authenticated ?? false);
  const privyUser = PRIVY_ENABLED ? (privyState?.user ?? null) : null;
  const privyLogin = privyState?.login;
  const privyLogout = privyState?.logout;

  // Account: from Privy wallet or fallback
  const account = PRIVY_ENABLED
    ? (privyUser?.wallet?.address || null)
    : fallbackAccount;

  // User display name: prefer social profile name > email > wallet address
  const userDisplayName = PRIVY_ENABLED && privyUser
    ? (privyUser.google?.name || privyUser.github?.username || privyUser.email?.address || (account ? `${account.slice(0, 6)}...${account.slice(-4)}` : null))
    : (account ? `${account.slice(0, 6)}...${account.slice(-4)}` : null);

  // Provider for NetworkCheck
  const provider = PRIVY_ENABLED ? null : fallbackProvider;

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

  // Hide sub-nav on scroll when in Network tab
  useEffect(() => {
    let lastScrollY = window.pageYOffset;

    const handleScroll = () => {
      const currentScrollY = window.pageYOffset;

      if (activeTab === 'graph') {
        // Hide when scrolling down, show when scrolling up
        if (currentScrollY > lastScrollY && currentScrollY > 20) {
          setHideSubNav(true);
        } else if (currentScrollY < lastScrollY) {
          setHideSubNav(false);
        }
      } else {
        setHideSubNav(false);
      }

      lastScrollY = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab]);

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

  // ─── Contract initialization (shared for both Privy and fallback) ──
  const initContracts = useCallback(async (signer) => {
    const researchGraph = new ethers.Contract(CONTRACTS.RESEARCH_GRAPH, ABIS.RESEARCH_GRAPH, signer);
    const usdc = new ethers.Contract(CONTRACTS.USDC, ABIS.ERC20, signer);
    const researchToken = new ethers.Contract(CONTRACTS.RESEARCH_TOKEN, ABIS.ERC20, signer);
    const predictionMarket = new ethers.Contract(CONTRACTS.PREDICTION_MARKET, ABIS.PREDICTION_MARKET, signer);
    setContracts({ researchGraph, usdc, researchToken, predictionMarket });
  }, []);

  // ─── Privy: set up contracts when wallet becomes available ─────
  useEffect(() => {
    if (!PRIVY_ENABLED || !privyAuthenticated || privyWallets.length === 0) return;
    let cancelled = false;

    async function setup() {
      try {
        const wallet = privyWallets[0];
        const ethersProvider = await wallet.getEthersProvider();
        const walletSigner = await ethersProvider.getSigner();
        if (cancelled) return;
        setSigner(walletSigner);
        await initContracts(walletSigner);
      } catch (err) {
        console.error('Error setting up Privy wallet:', err);
      }
    }
    setup();
    return () => { cancelled = true; };
  }, [PRIVY_ENABLED, privyAuthenticated, privyWallets, initContracts]);

  // ─── Fallback: MetaMask-only mode ─────────────────────────────
  useEffect(() => {
    if (PRIVY_ENABLED) return;
    if (window.ethereum) {
      const p = new ethers.BrowserProvider(window.ethereum);
      setFallbackProvider(p);
    }
  }, [PRIVY_ENABLED]);

  const connectWalletFallback = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }
    try {
      setLoading(true);
      const p = new ethers.BrowserProvider(window.ethereum);
      await p.send('eth_requestAccounts', []);
      const s = await p.getSigner();
      const address = await s.getAddress();
      setFallbackAccount(address);
      setSigner(s);
      await initContracts(s);
      setLoading(false);
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setLoading(false);
    }
  };

  // ─── Sign In handler (Privy or fallback) ──────────────────────
  const handleSignIn = useCallback(() => {
    if (PRIVY_ENABLED && privyLogin) {
      privyLogin();
    } else {
      connectWalletFallback();
    }
  }, [PRIVY_ENABLED, privyLogin]);

  // ─── Sign Out handler ─────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    if (PRIVY_ENABLED && privyLogout) {
      await privyLogout();
    }
    setSigner(null);
    setContracts({});
    setFallbackAccount(null);
  }, [PRIVY_ENABLED, privyLogout]);

  // ─── Network switching ────────────────────────────────────────
  const switchNetwork = async (networkKey) => {
    const network = NETWORKS[networkKey];
    // Use the first Privy wallet or fallback to window.ethereum
    const walletProvider = PRIVY_ENABLED && privyWallets.length > 0
      ? await privyWallets[0].getEthersProvider()
      : (window.ethereum ? window.ethereum : null);

    if (!walletProvider) return;

    // For Privy embedded wallets, we use the provider's send method
    // For MetaMask, we use window.ethereum.request
    const requester = walletProvider.request
      ? walletProvider
      : (window.ethereum || null);

    if (!requester) return;

    try {
      await requester.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: network.chainId }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await requester.request({
            method: 'wallet_addEthereumChain',
            params: [network],
          });
        } catch (addError) {
          console.error('Error adding network:', addError);
        }
      }
    }
  };

  // ─── Loading state while Privy initializes ────────────────────
  if (PRIVY_ENABLED && !privyReady) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="font-mono text-xs uppercase tracking-widest text-neutral-400 animate-pulse">
          Initializing...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900 font-sans">
      {!PRIVY_ENABLED && <NetworkCheck provider={provider} />}

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
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-neutral-200 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 transition-colors relative"
            onClick={() => setShowApiSettings(true)}
            title="AI Settings"
            aria-label="AI Settings"
          >
            <Settings className="h-4 w-4" />
            <span className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-white ${keyConfigured ? 'bg-green-500' : 'bg-amber-400'}`} />
          </Button>
          {account && (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 border-neutral-300 text-neutral-600 hover:bg-neutral-900 hover:text-white hover:border-neutral-900 transition-colors"
              onClick={() => setActiveTab('submit')}
              title="Submit Paper"
              aria-label="Submit Paper"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {!account ? (
            <Button
              variant="outline"
              className="border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white font-mono text-xs uppercase tracking-widest"
              onClick={handleSignIn}
              disabled={loading}
            >
              {PRIVY_ENABLED ? (
                <>
                  <UserIcon className="h-4 w-4" />
                  Sign In
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  {loading ? 'Connecting...' : 'Connect'}
                </>
              )}
            </Button>
          ) : (
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="font-mono text-[10px]">
                {userDisplayName}
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-neutral-400 hover:text-red-600"
                  onClick={handleSignOut}
                  aria-label="Sign Out"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* API Key Settings Panel */}
      <ApiKeySettings isOpen={showApiSettings} onClose={handleCloseApiSettings} />

      {/* Main Content */}
      <main className="pt-[64px] min-h-screen">
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
                  onClick={handleSignIn}
                  disabled={loading}
                >
                  {PRIVY_ENABLED ? (
                    <>
                      <UserIcon className="h-4 w-4" />
                      Enter The Republic
                    </>
                  ) : (
                    <>
                      <Wallet className="h-4 w-4" />
                      Enter The Republic
                    </>
                  )}
                </Button>
                {PRIVY_ENABLED && (
                  <p className="text-[11px] text-neutral-400 mt-3 font-mono">
                    Sign in with Google, GitHub, email, or connect wallet
                  </p>
                )}
              </motion.div>
            </section>

            {!trackConfig ? (
              /* Full mode: show all 3 tracks */
              <section className="py-24 grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                  { label: 'Knowledge Exchange', icon: '\u{1F4C8}', desc: 'Main Track: DeFi. LMSR-based prediction markets to price research truth and fund replication attempts trustlessly.', track: 'defi' },
                  { label: 'Agent Swarm', icon: '\u{1F916}', desc: 'Main Track: AI Application. Specialized agent castes reason over the graph with robust TRiSM guardrails and cross-chain verification.', track: 'ai' },
                  { label: 'Science Primitive', icon: '\u{1F9EC}', desc: 'Main Track: New Primitives. A research creator economy where papers are launched, verified, and cited as liquid assets.', track: 'consumer' },
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
                    { label: 'Live Feed', stat: '\u221E', desc: 'Real-time stream of paper launches, agent reviews, market moves, and alerts.' },
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
            <div className={`border-b border-neutral-200 bg-white sticky top-[64px] z-40 transition-transform duration-300 ${hideSubNav && activeTab === 'graph' ? '-translate-y-full' : 'translate-y-0'}`}>
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
                <TabErrorBoundary name="Vision">
                  <Vision />
                </TabErrorBoundary>
              </TabsContent>
              <TabsContent value="graph">
                <TabErrorBoundary name="Knowledge Graph">
                  <KnowledgeGraph
                    contracts={contracts}
                    account={account}
                    graphData={graphData}
                    setGraphData={setGraphData}
                    onImportPaper={handleImportPaper}
                    onMakeRunnable={handleMakeRunnable}
                    onReplicate={handleReplicate}
                  />
                </TabErrorBoundary>
              </TabsContent>
              <TabsContent value="submit">
                <TabErrorBoundary name="Submit Paper">
                  <SubmitPaper contracts={contracts} account={account} importData={importData} />
                </TabErrorBoundary>
              </TabsContent>
              <TabsContent value="predict">
                <TabErrorBoundary name="Prediction Market">
                  <PredictionMarket contracts={contracts} account={account} />
                </TabErrorBoundary>
              </TabsContent>
              <TabsContent value="agent">
                <TabErrorBoundary name="Paper2Agent">
                  <Paper2Agent agentPaper={agentPaper} />
                </TabErrorBoundary>
              </TabsContent>
              <TabsContent value="lab">
                <TabErrorBoundary name="AI Research Lab">
                  <AIResearchLab labPaper={labPaper} />
                </TabErrorBoundary>
              </TabsContent>
              <TabsContent value="kaggle">
                <TabErrorBoundary name="Kaggle Lab">
                  <KaggleLab />
                </TabErrorBoundary>
              </TabsContent>
              <TabsContent value="feed">
                <TabErrorBoundary name="Research Feed">
                  <ResearchFeed />
                </TabErrorBoundary>
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
              <a href="https://github.com/rexheng/the-republic" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors mb-1">
                GitHub
              </a>
              <a href="https://github.com/rexheng/the-republic#readme" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors mb-1">Documentation</a>
              <a href="https://github.com/rexheng/the-republic/blob/main/SECURITY_GUIDE.md" target="_blank" rel="noopener noreferrer" className="block hover:text-white transition-colors">Security Guide</a>
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

// Wrapper that calls Privy hooks (only rendered inside PrivyProvider)
function AppWithPrivy() {
  const privyState = usePrivy();
  const { wallets } = useWallets();
  return <AppCore privyState={privyState} privyWallets={wallets} />;
}

// Wrapper without Privy hooks (rendered when no PrivyProvider)
function AppWithoutPrivy() {
  return <AppCore />;
}

export default PRIVY_ENABLED ? AppWithPrivy : AppWithoutPrivy;
