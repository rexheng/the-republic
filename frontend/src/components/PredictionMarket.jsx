import React, { useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, BookOpen, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FadeIn } from '@/components/ui/fade-in';
import { fetchPolymarketEvents, getPolymarketUrl } from '../utils/polymarket';
import { searchPapers } from '../utils/semanticScholar';

// ─── LMSR math ────────────────────────────────────────────────────
function lmsrYesPrice(yesShares, noShares, b) {
  if (b === 0) return 0.5;
  const expYes = Math.exp(yesShares / b);
  const expNo = Math.exp(noShares / b);
  return expYes / (expYes + expNo);
}

function lmsrCost(yesShares, noShares, b, shares, isYes) {
  const costBefore = b * Math.log(Math.exp(yesShares / b) + Math.exp(noShares / b));
  const newYes = isYes ? yesShares + shares : yesShares;
  const newNo = isYes ? noShares : noShares + shares;
  const costAfter = b * Math.log(Math.exp(newYes / b) + Math.exp(newNo / b));
  return costAfter - costBefore;
}

// ─── Extract search keywords from a market question ───────────────
function extractSearchTerms(question) {
  const stopWords = new Set([
    'will', 'the', 'be', 'by', 'in', 'of', 'to', 'a', 'an', 'and', 'or',
    'is', 'are', 'was', 'were', 'has', 'have', 'had', 'do', 'does', 'did',
    'for', 'on', 'at', 'from', 'with', 'as', 'this', 'that', 'it', 'its',
    'than', 'more', 'most', 'can', 'could', 'should', 'would', 'may', 'might',
    'up', 'down', 'before', 'after', 'about', 'over', 'under', 'between',
    'through', 'during', 'into', 'out', 'what', 'which', 'who', 'whom',
    'how', 'when', 'where', 'why', 'not', 'no', 'yes', 'if', 'then',
  ]);
  const words = question.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  const keywords = words.filter(w => w.length > 2 && !stopWords.has(w));
  // Take the most distinctive 3-4 keywords
  return keywords.slice(0, 4).join(' ');
}

// ─── Demo data (on-chain LMSR markets) ────────────────────────────
const DEMO_MARKETS = [
  { id: 1, paperId: 1, paperTitle: 'Attention Is All You Need', question: 'Will Transformers remain the dominant architecture through 2027?', yesShares: 8500, noShares: 1500, b: 1000, totalParticipants: 142, endTime: Date.now() + 86400000 * 45, resolved: false, outcome: false },
  { id: 2, paperId: 5, paperTitle: 'Generative Adversarial Networks', question: 'Will GANs outperform diffusion models on FID scores by end of 2026?', yesShares: 3000, noShares: 7000, b: 1000, totalParticipants: 89, endTime: Date.now() + 86400000 * 120, resolved: false, outcome: false },
  { id: 3, paperId: 8, paperTitle: 'Denoising Diffusion Probabilistic Models', question: 'Can DDPM FID scores be replicated within 10% on standard hardware?', yesShares: 6200, noShares: 1800, b: 1000, totalParticipants: 67, endTime: Date.now() + 86400000 * 30, resolved: false, outcome: false },
  { id: 4, paperId: 12, paperTitle: 'Mastering the Game of Go', question: 'Were AlphaGo win rates accurately measured in the original study?', yesShares: 9000, noShares: 1000, b: 1000, totalParticipants: 203, endTime: Date.now() - 86400000 * 10, resolved: true, outcome: true },
  { id: 5, paperId: 3, paperTitle: 'Chain-of-Thought Prompting', question: 'Does CoT prompting improve GSM8K accuracy by more than 15%?', yesShares: 5500, noShares: 2500, b: 1000, totalParticipants: 54, endTime: Date.now() + 86400000 * 60, resolved: false, outcome: false },
  { id: 6, paperId: 15, paperTitle: 'Sparks of AGI: GPT-4 Experiments', question: 'Will key claims be validated by 3+ independent research groups?', yesShares: 2200, noShares: 5100, b: 1000, totalParticipants: 178, endTime: Date.now() - 86400000 * 5, resolved: true, outcome: false },
];

const DEMO_POSITIONS = [
  { marketId: 1, side: 'yes', shares: 500, timestamp: Date.now() - 86400000 * 3 },
  { marketId: 3, side: 'yes', shares: 200, timestamp: Date.now() - 86400000 * 1 },
];

function PredictionMarket({ contracts, account }) {
  const [filter, setFilter] = useState('active');
  const [source, setSource] = useState('republic'); // republic | polymarket
  const [expandedBet, setExpandedBet] = useState(null);
  const [betSide, setBetSide] = useState('yes');
  const [betShares, setBetShares] = useState('100');
  const [positions, setPositions] = useState(DEMO_POSITIONS);
  const [markets, setMarkets] = useState(DEMO_MARKETS);
  const [polymarketEvents, setPolymarketEvents] = useState([]);
  const [loadingPoly, setLoadingPoly] = useState(false);
  // Paper search state per market
  const [paperResults, setPaperResults] = useState({});
  const [loadingPapers, setLoadingPapers] = useState({});

  const getUserPosition = (marketId) => positions.find(p => p.marketId === marketId) || null;

  // Fetch Polymarket events on tab switch
  useEffect(() => {
    if (source === 'polymarket' && polymarketEvents.length === 0) {
      setLoadingPoly(true);
      fetchPolymarketEvents({ limit: 30, scienceOnly: false })
        .then(events => setPolymarketEvents(events))
        .finally(() => setLoadingPoly(false));
    }
  }, [source, polymarketEvents.length]);

  // Search for relevant academic papers for a market question
  const findRelatedPapers = useCallback(async (marketId, question) => {
    if (paperResults[marketId] || loadingPapers[marketId]) return;
    setLoadingPapers(prev => ({ ...prev, [marketId]: true }));
    try {
      const terms = extractSearchTerms(question);
      const results = await searchPapers(terms, 5);
      setPaperResults(prev => ({ ...prev, [marketId]: results }));
    } catch (err) {
      console.error('Paper search failed:', err);
      setPaperResults(prev => ({ ...prev, [marketId]: [] }));
    }
    setLoadingPapers(prev => ({ ...prev, [marketId]: false }));
  }, [paperResults, loadingPapers]);

  const activeMarkets = markets.filter(m => !m.resolved);
  const resolvedMarkets = markets.filter(m => m.resolved);
  const filteredMarkets = filter === 'active' ? activeMarkets : resolvedMarkets;
  const totalVolume = markets.reduce((sum, m) => sum + m.yesShares + m.noShares, 0);
  const totalParticipants = markets.reduce((sum, m) => sum + m.totalParticipants, 0);

  // Render a Polymarket event card
  const renderPolyCard = (event, i) => {
    const yesPrice = event.outcomePrices[0] || 0.5;
    const noPrice = event.outcomePrices[1] || 0.5;
    const yesPercent = Math.round(yesPrice * 100);
    const noPercent = 100 - yesPercent;
    const isExpanded = expandedBet === event.id;
    const papers = paperResults[event.id];
    const papersLoading = loadingPapers[event.id];

    return (
      <FadeIn key={event.id} delay={0.03 * i}>
        <div className="border border-neutral-100 p-6 hover:bg-neutral-50/50 transition-all group relative">
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col flex-1 mr-4">
              <h3 className="text-lg font-medium leading-snug">{event.question}</h3>
              {event.description && (
                <p className="text-xs text-neutral-500 mt-1 line-clamp-2">{event.description}</p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 flex-shrink-0">
              <Badge className="text-[9px] font-mono rounded-none bg-purple-100 text-purple-800 border-purple-200">POLYMARKET</Badge>
              <div className="text-[10px] font-mono text-neutral-400">
                {event.endDate ? new Date(event.endDate).toLocaleDateString() : 'Open'}
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-px bg-neutral-100 border border-neutral-100 mb-4">
            <div className="bg-white p-3">
              <div className="flex justify-between items-end mb-1">
                <span className="font-mono text-[9px] text-green-600 font-bold uppercase">{event.outcomes[0] || 'YES'}</span>
                <span className="text-xl font-light tabular-nums text-green-700">{yesPrice.toFixed(2)}</span>
              </div>
              <div className="h-1 bg-green-50 w-full">
                <div className="h-full bg-green-500" style={{ width: `${yesPercent}%` }} />
              </div>
            </div>
            <div className="bg-white p-3">
              <div className="flex justify-between items-end mb-1">
                <span className="font-mono text-[9px] text-red-600 font-bold uppercase">{event.outcomes[1] || 'NO'}</span>
                <span className="text-xl font-light tabular-nums text-red-700">{noPrice.toFixed(2)}</span>
              </div>
              <div className="h-1 bg-red-50 w-full flex justify-end">
                <div className="h-full bg-red-500" style={{ width: `${noPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-[10px] text-neutral-400 font-mono mb-4 uppercase tracking-wider">
            <div className="flex flex-col">
              <span className="text-[8px] text-neutral-300">Liquidity</span>
              <span>${(event.liquidity || 0).toLocaleString()}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-neutral-300">Spread</span>
              <span>{((event.bestAsk - event.bestBid) * 100).toFixed(1)}%</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <a
              href={event.polymarketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 h-10 border border-purple-600 text-purple-700 hover:bg-purple-700 hover:text-white font-mono text-[10px] uppercase tracking-widest transition-all"
            >
              <ExternalLink className="h-3 w-3" />
              Trade on Polymarket
            </a>
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-[10px] uppercase tracking-widest h-10 px-4 rounded-none"
              onClick={() => {
                setExpandedBet(isExpanded ? null : event.id);
                if (!isExpanded) findRelatedPapers(event.id, event.question);
              }}
            >
              <BookOpen className="h-3 w-3 mr-1.5" />
              {isExpanded ? 'Hide Papers' : 'Related Research'}
            </Button>
          </div>

          {/* Related papers panel */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 p-4 border border-neutral-200 bg-neutral-50 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="h-3.5 w-3.5 text-neutral-400" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                      Semantic Scholar — Related Papers
                    </span>
                  </div>

                  {papersLoading && (
                    <div className="flex items-center gap-2 text-neutral-400 text-xs py-4">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Searching academic literature...
                    </div>
                  )}

                  {papers && papers.length === 0 && (
                    <div className="text-neutral-400 text-xs italic py-2">No closely related papers found.</div>
                  )}

                  {papers && papers.map((paper, j) => (
                    <div key={paper.paperId || j} className="flex flex-col gap-1 border-b border-neutral-100 pb-2 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <a
                            href={`https://www.semanticscholar.org/paper/${paper.paperId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-neutral-800 hover:text-blue-600 transition-colors line-clamp-2"
                          >
                            {paper.title}
                          </a>
                          <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                            {paper.authors?.slice(0, 3).map(a => typeof a === 'string' ? a : a.name).join(', ')}
                            {paper.authors?.length > 3 ? ' et al.' : ''} ({paper.year})
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[8px] font-mono flex-shrink-0">
                          {(paper.citationCount || 0).toLocaleString()} cites
                        </Badge>
                      </div>
                      {paper.tldr?.text && (
                        <p className="text-[11px] text-neutral-500 italic line-clamp-2">{paper.tldr.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </FadeIn>
    );
  };

  // Render a Republic on-chain market card
  const renderRepublicCard = (market, i) => {
    const yesPrice = lmsrYesPrice(market.yesShares, market.noShares, market.b);
    const noPrice = 1 - yesPrice;
    const yesPercent = Math.round(yesPrice * 100);
    const noPercent = 100 - yesPercent;
    const userPos = getUserPosition(market.id);
    const isExpanded = expandedBet === market.id;
    const papers = paperResults[market.id];
    const papersLoading = loadingPapers[market.id];

    return (
      <FadeIn key={market.id} delay={0.05 * i}>
        <div className="border border-neutral-100 p-6 hover:bg-neutral-50/50 transition-all cursor-crosshair group relative">
          <div className="flex items-start justify-between mb-4">
            <div className="flex flex-col">
              <span className="font-mono text-[9px] uppercase tracking-tighter text-neutral-400 mb-1">{market.paperTitle}</span>
              <h3 className="text-lg font-medium leading-snug group-hover:text-neutral-900 transition-colors">{market.question}</h3>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="outline" className="text-[9px] font-mono rounded-none border-neutral-300">LP_POOL_ID: {market.id}</Badge>
              <div className="text-[10px] font-mono text-neutral-400 italic">ENDS: {new Date(market.endTime).toLocaleDateString()}</div>
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-px bg-neutral-100 border border-neutral-100 mb-6">
            <div className="bg-white p-3">
              <div className="flex justify-between items-end mb-1">
                <span className="font-mono text-[9px] text-green-600 font-bold uppercase">BID_YES</span>
                <span className="text-xl font-light tabular-nums text-green-700">{yesPrice.toFixed(4)}</span>
              </div>
              <div className="h-1 bg-green-50 w-full">
                <div className="h-full bg-green-500" style={{ width: `${yesPercent}%` }} />
              </div>
            </div>
            <div className="bg-white p-3">
              <div className="flex justify-between items-end mb-1">
                <span className="font-mono text-[9px] text-red-600 font-bold uppercase">ASK_NO</span>
                <span className="text-xl font-light tabular-nums text-red-700">{noPrice.toFixed(4)}</span>
              </div>
              <div className="h-1 bg-red-50 w-full flex justify-end">
                <div className="h-full bg-red-500" style={{ width: `${noPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-[10px] text-neutral-400 font-mono mb-6 uppercase tracking-wider">
            <div className="flex flex-col">
              <span className="text-[8px] text-neutral-300">Volume</span>
              <span>{(market.yesShares + market.noShares).toLocaleString()} RESEARCH</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-neutral-300">Liquidity</span>
              <span>{market.b} (LMSR)</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] text-neutral-300">Settlement</span>
              <span className="text-blue-500">FLARE_COSTON2</span>
            </div>
          </div>

          {userPos && (
            <div className={`p-4 mb-4 font-mono text-xs flex justify-between items-center ${userPos.side === 'yes' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <div>
                <span className="opacity-60 mr-2">POSITION:</span>
                <span className="font-bold">{userPos.side.toUpperCase()} — {userPos.shares} SHARES</span>
              </div>
              {market.resolved && ((market.outcome && userPos.side === 'yes') || (!market.outcome && userPos.side === 'no')) && (
                <Button className="h-7 px-4 bg-neutral-900 text-white text-[10px] rounded-none uppercase">Settle Payout</Button>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {!market.resolved && !userPos && (
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-[10px] uppercase tracking-widest h-10 px-8 rounded-none border-neutral-900 hover:bg-neutral-900 hover:text-white transition-all"
                onClick={() => setExpandedBet(isExpanded ? null : market.id)}
              >
                {isExpanded ? 'Cancel' : 'Open Position'}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-[10px] uppercase tracking-widest h-10 px-4 rounded-none"
              onClick={() => {
                const wasExpanded = expandedBet === `papers_${market.id}`;
                setExpandedBet(wasExpanded ? null : `papers_${market.id}`);
                if (!wasExpanded) findRelatedPapers(market.id, market.question);
              }}
            >
              <BookOpen className="h-3 w-3 mr-1.5" />
              Related Research
            </Button>
          </div>

          {/* Trading panel */}
          {isExpanded && typeof isExpanded === 'number' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 p-6 border border-neutral-900 bg-neutral-50 space-y-4"
            >
              <div className="flex gap-4">
                <button
                  className={`flex-1 py-3 font-mono text-xs border ${betSide === 'yes' ? 'bg-green-700 text-white border-green-700' : 'bg-white border-neutral-200 text-neutral-400'}`}
                  onClick={() => setBetSide('yes')}
                >BUY YES</button>
                <button
                  className={`flex-1 py-3 font-mono text-xs border ${betSide === 'no' ? 'bg-red-700 text-white border-red-700' : 'bg-white border-neutral-200 text-neutral-400'}`}
                  onClick={() => setBetSide('no')}
                >BUY NO</button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-mono text-[9px] uppercase text-neutral-400">Amount (Shares)</label>
                  <Input
                    type="number"
                    value={betShares}
                    onChange={(e) => setBetShares(e.target.value)}
                    placeholder="0.00"
                    className="h-10 rounded-none font-mono text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-mono text-[9px] uppercase text-neutral-400">Estimated Cost</label>
                  <div className="h-10 flex items-center px-3 bg-white border border-neutral-200 font-mono text-sm">
                    {lmsrCost(market.yesShares, market.noShares, market.b, parseFloat(betShares) || 0, betSide === 'yes').toFixed(2)} RES
                  </div>
                </div>
              </div>
              <Button className="w-full bg-neutral-900 text-white hover:bg-neutral-800 h-12 rounded-none font-mono text-xs uppercase tracking-widest">
                Execute Exchange
              </Button>
            </motion.div>
          )}

          {/* Related papers panel */}
          <AnimatePresence>
            {expandedBet === `papers_${market.id}` && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 p-4 border border-neutral-200 bg-neutral-50 space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Search className="h-3.5 w-3.5 text-neutral-400" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
                      Semantic Scholar — Related Papers
                    </span>
                  </div>
                  {papersLoading && (
                    <div className="flex items-center gap-2 text-neutral-400 text-xs py-4">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Searching academic literature...
                    </div>
                  )}
                  {papers && papers.length === 0 && (
                    <div className="text-neutral-400 text-xs italic py-2">No closely related papers found.</div>
                  )}
                  {papers && papers.map((paper, j) => (
                    <div key={paper.paperId || j} className="flex flex-col gap-1 border-b border-neutral-100 pb-2 last:border-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <a
                            href={`https://www.semanticscholar.org/paper/${paper.paperId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-neutral-800 hover:text-blue-600 transition-colors line-clamp-2"
                          >
                            {paper.title}
                          </a>
                          <div className="text-[10px] text-neutral-400 font-mono mt-0.5">
                            {paper.authors?.slice(0, 3).map(a => typeof a === 'string' ? a : a.name).join(', ')}
                            {paper.authors?.length > 3 ? ' et al.' : ''} ({paper.year})
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[8px] font-mono flex-shrink-0">
                          {(paper.citationCount || 0).toLocaleString()} cites
                        </Badge>
                      </div>
                      {paper.tldr?.text && (
                        <p className="text-[11px] text-neutral-500 italic line-clamp-2">{paper.tldr.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </FadeIn>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3">
        <FadeIn>
          <span className="section-label mb-2 block text-neutral-400">Main Track: Prediction Markets & DeFi</span>
          <h2 className="section-title mb-2 italic underline decoration-neutral-200 underline-offset-8">Knowledge Exchange Terminal</h2>
          <p className="body-text text-sm mb-8 font-light max-w-2xl">
            LMSR truth-discovery engine on Flare + live Polymarket integration.
            Trade research verification on-chain or explore real-world prediction markets with AI-powered academic context.
          </p>
        </FadeIn>

        {/* Stats */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-neutral-200 border border-neutral-200 mb-8 overflow-hidden">
            {[
              { value: activeMarkets.length, label: 'Republic Markets' },
              { value: `${(totalVolume / 1000).toFixed(1)}k`, label: 'On-Chain Volume' },
              { value: polymarketEvents.length || '...', label: 'Polymarket Live' },
              { value: resolvedMarkets.length, label: 'Settled' },
            ].map((s, i) => (
              <div key={i} className="bg-white p-4">
                <div className="text-xl font-light tabular-nums">{s.value}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">{s.label}</div>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Source + Filter tabs */}
        <div className="flex gap-1 border-b border-neutral-100 mb-6">
          <button
            className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-all ${source === 'republic' ? 'text-neutral-900 border-b-2 border-neutral-900 -mb-px' : 'text-neutral-400 hover:text-neutral-600'}`}
            onClick={() => setSource('republic')}
          >
            Republic (On-Chain)
          </button>
          <button
            className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-all ${source === 'polymarket' ? 'text-purple-700 border-b-2 border-purple-600 -mb-px' : 'text-neutral-400 hover:text-neutral-600'}`}
            onClick={() => setSource('polymarket')}
          >
            Polymarket (Live)
          </button>
          <div className="flex-1" />
          {source === 'republic' && ['active', 'resolved'].map(f => (
            <button
              key={f}
              className={`px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition-all ${filter === f ? 'text-neutral-600 underline underline-offset-4' : 'text-neutral-300 hover:text-neutral-500'}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Markets list */}
        <div className="space-y-4">
          {source === 'republic' && filteredMarkets.map((market, i) => renderRepublicCard(market, i))}

          {source === 'polymarket' && loadingPoly && (
            <div className="flex items-center justify-center gap-3 py-16 text-neutral-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-mono text-xs uppercase tracking-widest">Fetching live Polymarket events...</span>
            </div>
          )}

          {source === 'polymarket' && !loadingPoly && polymarketEvents.map((event, i) => renderPolyCard(event, i))}
        </div>
      </div>

      {/* Sidebar */}
      <div className="lg:col-span-1 border-l border-neutral-100 pl-8 hidden lg:block">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 mb-6 underline underline-offset-4">Recent Activity</h4>
        <div className="space-y-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-col gap-1 border-b border-neutral-50 pb-4">
              <div className="flex justify-between items-center text-[10px] font-mono">
                <span className={i % 3 === 0 ? 'text-green-600' : 'text-red-600'}>{i % 3 === 0 ? 'BUY_YES' : 'BUY_NO'}</span>
                <span className="text-neutral-300">0.40{i} ETH</span>
              </div>
              <div className="text-[11px] font-light text-neutral-600 line-clamp-1 italic">
                {DEMO_MARKETS[i % 5]?.question}
              </div>
              <div className="text-[8px] font-mono text-neutral-300 uppercase italic">T-{i + 2} mins ago</div>
            </div>
          ))}
        </div>

        <div className="mt-12 p-4 bg-neutral-50 border border-neutral-100 italic text-[11px] text-neutral-500 leading-relaxed">
          <strong>Linguistic Forensics Note:</strong> Markets for papers flagged by Warrior agents are subject to higher collateral requirements.
        </div>
      </div>
    </div>
  );
}

export default PredictionMarket;
