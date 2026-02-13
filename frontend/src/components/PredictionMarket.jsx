import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ethers } from 'ethers';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, BookOpen, Search, Loader2, Filter, X, TrendingUp, DollarSign, Clock, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FadeIn } from '@/components/ui/fade-in';
import { fetchPolymarketEvents, getPolymarketUrl, ACADEMIC_FIELDS } from '../utils/polymarket';
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
const STOP_WORDS = new Set([
  'will', 'the', 'be', 'by', 'in', 'of', 'to', 'a', 'an', 'and', 'or',
  'is', 'are', 'was', 'were', 'has', 'have', 'had', 'do', 'does', 'did',
  'for', 'on', 'at', 'from', 'with', 'as', 'this', 'that', 'it', 'its',
  'than', 'more', 'most', 'can', 'could', 'should', 'would', 'may', 'might',
  'up', 'down', 'before', 'after', 'about', 'over', 'under', 'between',
  'through', 'during', 'into', 'out', 'what', 'which', 'who', 'whom',
  'how', 'when', 'where', 'why', 'not', 'no', 'yes', 'if', 'then',
  // Prediction-market noise words
  'win', 'lose', 'happen', 'occur', 'reach', 'hit', 'pass', 'fail',
  'end', 'start', 'begin', 'next', 'new', 'become', 'remain', 'get',
  'above', 'below', 'least', 'within', 'first', 'last', 'both',
  'any', 'each', 'every', 'some', 'many', 'much', 'such',
  'january', 'february', 'march', 'april', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
  'year', 'month', 'day', 'week', 'time', 'date', 'ago',
  'percent', 'number', 'total', 'whether', 'announce', 'officially',
]);

function extractKeywords(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));
}

// ─── Detect multi-word phrases that should stay together ──────────
const BIGRAMS = [
  'machine learning', 'deep learning', 'artificial intelligence',
  'climate change', 'global warming', 'federal reserve', 'interest rate',
  'natural language', 'neural network', 'public health', 'mental health',
  'supply chain', 'real estate', 'foreign policy', 'economic growth',
  'gene therapy', 'drug approval', 'clinical trial', 'renewable energy',
  'quantum computing', 'autonomous vehicles', 'social media',
  'central bank', 'fiscal policy', 'monetary policy',
  'stock market', 'cryptocurrency', 'blockchain',
  'supreme court', 'executive order', 'national security',
  'trade war', 'debt ceiling', 'government shutdown',
  'housing market', 'labor market', 'oil price',
  'space exploration', 'nuclear energy', 'electric vehicle',
  'generative ai', 'large language', 'foundation model',
];

function extractPhrases(text) {
  const lower = (text || '').toLowerCase();
  return BIGRAMS.filter(bg => lower.includes(bg));
}

// ─── Domain detection for field-aware scoring ─────────────────────
const DOMAIN_SIGNALS = {
  'Computer Science': ['ai', 'algorithm', 'software', 'computing', 'neural', 'model', 'data', 'gpt', 'llm', 'transformer', 'crypto', 'blockchain', 'bitcoin', 'ethereum', 'tech', 'app', 'platform'],
  'Economics': ['gdp', 'inflation', 'recession', 'market', 'trade', 'tariff', 'fed', 'economy', 'fiscal', 'monetary', 'stock', 'price', 'currency', 'treasury', 'bond', 'debt', 'deficit'],
  'Political Science': ['election', 'vote', 'poll', 'president', 'congress', 'senate', 'democrat', 'republican', 'party', 'campaign', 'legislation', 'governor', 'ballot', 'primary', 'inaugur'],
  'Medicine': ['fda', 'drug', 'vaccine', 'trial', 'disease', 'health', 'patient', 'treatment', 'therapy', 'clinical', 'cancer', 'covid', 'pandemic', 'diagnosis', 'mortality'],
  'Environmental Science': ['climate', 'carbon', 'emission', 'temperature', 'energy', 'renewable', 'solar', 'wind', 'fossil', 'wildfire', 'drought', 'sea level'],
  'Physics': ['quantum', 'particle', 'fusion', 'cern', 'spacex', 'nasa', 'orbit', 'rocket', 'satellite'],
  'Law': ['legal', 'court', 'ruling', 'lawsuit', 'regulation', 'compliance', 'antitrust', 'indictment', 'verdict'],
};

function detectDomains(text) {
  const lower = (text || '').toLowerCase();
  const matches = [];
  for (const [field, signals] of Object.entries(DOMAIN_SIGNALS)) {
    const hits = signals.filter(s => lower.includes(s)).length;
    if (hits >= 1) matches.push({ field, hits });
  }
  return matches.sort((a, b) => b.hits - a.hits).map(m => m.field);
}

function extractSearchTerms(question, description) {
  const fullText = `${question} ${description || ''}`;
  const phrases = extractPhrases(fullText);
  const keywords = extractKeywords(fullText)
    .filter(w => !phrases.some(p => p.includes(w)));
  const terms = [...phrases, ...keywords.slice(0, Math.max(2, 4 - phrases.length))];
  return terms.join(' ').slice(0, 100);
}

// ─── Score and rank papers by relevance to a market question ──────
function scoreAndRankPapers(papers, question, description) {
  const fullText = `${question} ${description || ''}`;
  const qKeywords = extractKeywords(fullText);
  const detectedDomains = detectDomains(fullText);
  if (qKeywords.length === 0) return papers.map(p => ({ ...p, relevance: 0, relevanceTag: '' }));

  const scored = papers.map(paper => {
    let score = 0;
    const titleKeywords = extractKeywords(paper.title);
    const abstractKeywords = extractKeywords(paper.abstract || paper.tldr?.text || '');

    // Title match (3x weight)
    for (const qk of qKeywords) {
      for (const tk of titleKeywords) {
        if (tk === qk) score += 3;
        else if (qk.length >= 4 && (tk.includes(qk) || qk.includes(tk))) score += 1.5;
      }
    }

    // Abstract match (1x weight)
    for (const qk of qKeywords) {
      for (const ak of abstractKeywords) {
        if (ak === qk) score += 1;
        else if (qk.length >= 4 && (ak.includes(qk) || qk.includes(ak))) score += 0.3;
      }
    }

    // Citation impact bonus (log scale, capped)
    score += Math.min(Math.log10((paper.citationCount || 0) + 1) * 0.5, 3);

    // Recency bonus (papers from last 3 years get a boost)
    if (paper.year && paper.year >= new Date().getFullYear() - 3) score += 1;

    // Domain field match: boost papers in detected domains, penalize off-domain
    const paperFields = (paper.fieldsOfStudy || []).map(f =>
      typeof f === 'string' ? f.toLowerCase() : ''
    );
    if (detectedDomains.length > 0 && paperFields.length > 0) {
      const fieldOverlap = detectedDomains.some(d =>
        paperFields.some(pf => pf.includes(d.toLowerCase().split(' ')[0]))
      );
      if (fieldOverlap) score += 2;
      else score *= 0.5;
    }

    // Determine relevance tag
    let relevanceTag = '';
    const titleHits = qKeywords.filter(qk => titleKeywords.some(tk => tk === qk || (qk.length >= 4 && (tk.includes(qk) || qk.includes(tk)))));
    if (titleHits.length >= 2) relevanceTag = 'Direct match';
    else if (titleHits.length === 1) relevanceTag = 'Title overlap';
    else if (score > 2) relevanceTag = 'Related concepts';
    else relevanceTag = 'Background';

    return { ...paper, _score: score, relevanceTag };
  });

  // Sort by score descending
  scored.sort((a, b) => b._score - a._score);

  // Normalize to 0-100 relevance
  const maxScore = scored[0]?._score || 1;
  return scored.map(p => ({
    ...p,
    relevance: Math.round((p._score / maxScore) * 100),
  }));
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
  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeField, setActiveField] = useState(null); // selected academic field
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState('volume'); // volume | liquidity | newest

  const getUserPosition = (marketId) => positions.find(p => p.marketId === marketId) || null;

  // Fetch Polymarket events on tab switch or when filters change
  const loadPolymarketEvents = useCallback(async (opts = {}) => {
    setLoadingPoly(true);
    try {
      const events = await fetchPolymarketEvents({
        limit: 30,
        search: opts.search || searchQuery,
        tag: opts.tag || '',
      });
      setPolymarketEvents(events);
    } catch (err) {
      console.error('Polymarket fetch failed:', err);
    } finally {
      setLoadingPoly(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (source === 'polymarket' && polymarketEvents.length === 0) {
      loadPolymarketEvents();
    }
  }, [source]);

  // Handle search submission
  const handleSearch = useCallback((e) => {
    e?.preventDefault?.();
    setSearchQuery(searchInput);
    loadPolymarketEvents({ search: searchInput });
  }, [searchInput, loadPolymarketEvents]);

  // Handle field filter
  const handleFieldFilter = useCallback((field) => {
    if (activeField === field) {
      setActiveField(null);
      setSearchQuery('');
      setSearchInput('');
      loadPolymarketEvents({ search: '' });
    } else {
      setActiveField(field);
      setSearchInput(field);
      setSearchQuery(field);
      loadPolymarketEvents({ search: field });
    }
  }, [activeField, loadPolymarketEvents]);

  // Filter + sort Polymarket events client-side
  const filteredPolyEvents = useMemo(() => {
    let events = [...polymarketEvents];

    // Filter by active academic field
    if (activeField) {
      events = events.filter(e => e.fields?.includes(activeField));
    }

    // Sort
    if (sortBy === 'volume') {
      events.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    } else if (sortBy === 'liquidity') {
      events.sort((a, b) => (b.liquidity || 0) - (a.liquidity || 0));
    } else if (sortBy === 'newest') {
      events.sort((a, b) => new Date(b.endDate || 0) - new Date(a.endDate || 0));
    }

    return events;
  }, [polymarketEvents, activeField, sortBy]);

  // Search for relevant academic papers for a market question, then rank by relevance
  const findRelatedPapers = useCallback(async (marketId, question, description) => {
    setLoadingPapers(prev => {
      if (prev[marketId]) return prev;
      return { ...prev, [marketId]: true };
    });
    setPaperResults(prev => {
      if (prev[marketId]) return prev;
      return prev;
    });
    try {
      const fullTerms = extractSearchTerms(question, description);
      const coreTerms = extractKeywords(question).slice(0, 2).join(' ');

      // Two parallel searches — broad (with description context) + focused (core keywords)
      const [broadResults, focusedResults] = await Promise.all([
        searchPapers(fullTerms, 12),
        coreTerms && coreTerms !== fullTerms ? searchPapers(coreTerms, 8) : Promise.resolve([]),
      ]);

      // Merge and deduplicate by paperId
      const seen = new Set();
      const merged = [];
      for (const p of [...focusedResults, ...broadResults]) {
        if (p.paperId && !seen.has(p.paperId)) {
          seen.add(p.paperId);
          merged.push(p);
        }
      }

      const ranked = scoreAndRankPapers(merged, question, description)
        .filter(p => p.relevance >= 20)
        .slice(0, 5);
      setPaperResults(prev => ({ ...prev, [marketId]: ranked }));
    } catch (err) {
      console.error('Paper search failed:', err);
      setPaperResults(prev => ({ ...prev, [marketId]: [] }));
    }
    setLoadingPapers(prev => ({ ...prev, [marketId]: false }));
  }, []);

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
        <div className="border border-neutral-100 hover:border-neutral-200 hover:bg-neutral-50/30 transition-all group relative overflow-hidden">
          {/* Header with image */}
          <div className="flex">
            {event.image && (
              <div className="w-20 h-20 flex-shrink-0 overflow-hidden bg-neutral-100">
                <img
                  src={event.image}
                  alt=""
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                  onError={e => { e.target.style.display = 'none'; }}
                />
              </div>
            )}
            <div className="flex-1 p-4 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h3 className="text-[15px] font-medium leading-snug line-clamp-2">{event.question}</h3>
                  {event.description && event.description !== event.question && (
                    <p className="text-[11px] text-neutral-400 mt-1 line-clamp-1">{event.description}</p>
                  )}
                </div>
                <Badge className="text-[8px] font-mono rounded-none bg-purple-50 text-purple-700 border-purple-200 flex-shrink-0">POLYMARKET</Badge>
              </div>
              {/* Field tags */}
              {event.fields && event.fields.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {event.fields.slice(0, 3).map(f => (
                    <span
                      key={f}
                      onClick={() => handleFieldFilter(f)}
                      className="text-[8px] font-mono px-1.5 py-0.5 bg-blue-50 text-blue-600 cursor-pointer hover:bg-blue-100 transition-colors"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pricing bar */}
          <div className="px-4 pb-3">
            <div className="grid grid-cols-2 gap-px bg-neutral-100 border border-neutral-100">
              <div className="bg-white p-2.5">
                <div className="flex justify-between items-end mb-1">
                  <span className="font-mono text-[9px] text-green-600 font-bold uppercase">{event.outcomes[0] || 'YES'}</span>
                  <span className="text-lg font-light tabular-nums text-green-700">{yesPrice.toFixed(2)}</span>
                </div>
                <div className="h-1 bg-green-50 w-full">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${yesPercent}%` }} />
                </div>
              </div>
              <div className="bg-white p-2.5">
                <div className="flex justify-between items-end mb-1">
                  <span className="font-mono text-[9px] text-red-600 font-bold uppercase">{event.outcomes[1] || 'NO'}</span>
                  <span className="text-lg font-light tabular-nums text-red-700">{noPrice.toFixed(2)}</span>
                </div>
                <div className="h-1 bg-red-50 w-full flex justify-end">
                  <div className="h-full bg-red-500 transition-all" style={{ width: `${noPercent}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="px-4 pb-3 flex items-center gap-5 text-[10px] text-neutral-400 font-mono uppercase tracking-wider">
            <div className="flex items-center gap-1">
              <DollarSign className="h-3 w-3" />
              <span>${(event.volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              <span>${(event.liquidity || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{event.endDate ? new Date(event.endDate).toLocaleDateString() : 'Open'}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="px-4 pb-4 flex items-center gap-2">
            <a
              href={event.polymarketUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 h-8 border border-purple-600 text-purple-700 hover:bg-purple-700 hover:text-white font-mono text-[9px] uppercase tracking-widest transition-all"
            >
              <ExternalLink className="h-3 w-3" />
              Trade
            </a>
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-[9px] uppercase tracking-widest h-8 px-3 rounded-none"
              onClick={() => {
                setExpandedBet(isExpanded ? null : event.id);
                if (!isExpanded) findRelatedPapers(event.id, event.question, event.description);
              }}
            >
              <BookOpen className="h-3 w-3 mr-1" />
              {isExpanded ? 'Hide' : 'Research'}
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

                  {papers && papers.map((paper, j) => renderPaperCard(paper, j))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </FadeIn>
    );
  };

  // Shared paper card with relevance bar
  const renderPaperCard = (paper, j) => {
    const relevance = paper.relevance || 0;
    const tag = paper.relevanceTag || '';
    return (
      <div key={paper.paperId || j} className="flex flex-col gap-1.5 border-b border-neutral-100 pb-3 last:border-0">
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
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <Badge variant="outline" className="text-[8px] font-mono">
              {(paper.citationCount || 0).toLocaleString()} cites
            </Badge>
            {tag && (
              <span className={`text-[8px] font-mono px-1.5 py-0.5 ${
                tag === 'Direct match' ? 'bg-green-50 text-green-700' :
                tag === 'Title overlap' ? 'bg-blue-50 text-blue-600' :
                tag === 'Related concepts' ? 'bg-amber-50 text-amber-700' :
                'bg-neutral-100 text-neutral-500'
              }`}>
                {tag}
              </span>
            )}
          </div>
        </div>
        {/* Relevance bar */}
        {relevance > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${relevance}%`,
                  background: relevance > 70 ? '#16a34a' : relevance > 40 ? '#ca8a04' : '#9ca3af',
                }}
              />
            </div>
            <span className="text-[9px] font-mono text-neutral-400 w-7 text-right">{relevance}%</span>
          </div>
        )}
        {paper.tldr?.text && (
          <p className="text-[11px] text-neutral-500 italic line-clamp-2">{paper.tldr.text}</p>
        )}
      </div>
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
                if (!wasExpanded) findRelatedPapers(market.id, market.question, '');
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
                  {papers && papers.map((paper, j) => renderPaperCard(paper, j))}
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

          {source === 'polymarket' && (
            <>
              {/* Search + Filter bar */}
              <FadeIn delay={0.05}>
                <div className="space-y-3 mb-6">
                  {/* Search input */}
                  <form onSubmit={handleSearch} className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                      <Input
                        type="text"
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        placeholder="Search questions, topics, e.g. 'climate change', 'election'..."
                        className="h-9 pl-9 rounded-none font-mono text-xs border-neutral-200 focus:border-purple-400"
                      />
                      {searchInput && (
                        <button
                          type="button"
                          onClick={() => { setSearchInput(''); setSearchQuery(''); setActiveField(null); loadPolymarketEvents({ search: '' }); }}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <Button type="submit" variant="outline" size="sm" className="h-9 px-4 rounded-none font-mono text-[9px] uppercase tracking-widest">
                      Search
                    </Button>
                  </form>

                  {/* Academic field chips */}
                  <div className="flex flex-wrap gap-1.5">
                    <span className="flex items-center gap-1 text-[9px] font-mono text-neutral-400 uppercase tracking-wider mr-1">
                      <Tag className="h-3 w-3" /> Fields:
                    </span>
                    {ACADEMIC_FIELDS.map(field => (
                      <button
                        key={field}
                        onClick={() => handleFieldFilter(field)}
                        className={`px-2 py-1 text-[9px] font-mono uppercase tracking-wider border transition-all ${
                          activeField === field
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'bg-white text-neutral-500 border-neutral-200 hover:border-purple-300 hover:text-purple-600'
                        }`}
                      >
                        {field}
                      </button>
                    ))}
                  </div>

                  {/* Sort options */}
                  <div className="flex items-center gap-3 text-[9px] font-mono uppercase tracking-wider text-neutral-400">
                    <span>Sort:</span>
                    {[
                      { key: 'volume', label: 'Volume', icon: DollarSign },
                      { key: 'liquidity', label: 'Liquidity', icon: TrendingUp },
                      { key: 'newest', label: 'End Date', icon: Clock },
                    ].map(opt => (
                      <button
                        key={opt.key}
                        onClick={() => setSortBy(opt.key)}
                        className={`flex items-center gap-1 px-2 py-1 transition-all ${
                          sortBy === opt.key ? 'text-neutral-700 underline underline-offset-4' : 'hover:text-neutral-600'
                        }`}
                      >
                        <opt.icon className="h-3 w-3" />
                        {opt.label}
                      </button>
                    ))}
                    <span className="ml-auto text-neutral-300">{filteredPolyEvents.length} events</span>
                  </div>
                </div>
              </FadeIn>

              {/* Loading state */}
              {loadingPoly && (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 className="h-5 w-5 animate-spin text-purple-500" />
                  <span className="font-mono text-xs uppercase tracking-widest text-neutral-400">Fetching live Polymarket events...</span>
                  <div className="w-64 h-1 bg-neutral-100 overflow-hidden">
                    <div className="h-full bg-purple-500 animate-pulse" style={{
                      animation: 'loading-bar 2s ease-in-out infinite',
                      width: '100%',
                      transformOrigin: 'left',
                    }} />
                  </div>
                  <style>{`
                    @keyframes loading-bar {
                      0% { transform: scaleX(0); transform-origin: left; }
                      50% { transform: scaleX(1); transform-origin: left; }
                      51% { transform: scaleX(1); transform-origin: right; }
                      100% { transform: scaleX(0); transform-origin: right; }
                    }
                  `}</style>
                </div>
              )}

              {/* Empty state */}
              {!loadingPoly && filteredPolyEvents.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-neutral-400">
                  <Search className="h-6 w-6 text-neutral-300" />
                  <span className="font-mono text-xs uppercase tracking-widest">
                    {searchQuery || activeField ? 'No matching events found' : 'No events loaded'}
                  </span>
                  <p className="text-[11px] text-neutral-400 max-w-md text-center">
                    {searchQuery || activeField
                      ? 'Try a different search term or clear the filters above.'
                      : 'Click retry to fetch live events from Polymarket.'}
                  </p>
                  <button
                    className="px-4 py-2 border border-purple-300 text-purple-600 font-mono text-[10px] uppercase tracking-widest hover:bg-purple-50 transition-all"
                    onClick={() => {
                      setSearchInput('');
                      setSearchQuery('');
                      setActiveField(null);
                      loadPolymarketEvents({ search: '' });
                    }}
                  >
                    {searchQuery || activeField ? 'Clear & Reload' : 'Retry'}
                  </button>
                </div>
              )}

              {/* Events grid */}
              {!loadingPoly && filteredPolyEvents.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredPolyEvents.map((event, i) => renderPolyCard(event, i))}
                </div>
              )}
            </>
          )}
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
