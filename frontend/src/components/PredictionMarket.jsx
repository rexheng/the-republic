import React, { useState, useCallback } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FadeIn } from '@/components/ui/fade-in';

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

// LMSR price calculation: p_yes = e^(qYes/b) / (e^(qYes/b) + e^(qNo/b))
function lmsrYesPrice(yesShares, noShares, b) {
  if (b === 0) return 0.5;
  const expYes = Math.exp(yesShares / b);
  const expNo = Math.exp(noShares / b);
  return expYes / (expYes + expNo);
}

// LMSR cost to buy `shares` on a given side
function lmsrCost(yesShares, noShares, b, shares, isYes) {
  const costBefore = b * Math.log(Math.exp(yesShares / b) + Math.exp(noShares / b));
  const newYes = isYes ? yesShares + shares : yesShares;
  const newNo = isYes ? noShares : noShares + shares;
  const costAfter = b * Math.log(Math.exp(newYes / b) + Math.exp(newNo / b));
  return costAfter - costBefore;
}

function PredictionMarket({ contracts, account }) {
  const [filter, setFilter] = useState('active');
  const [expandedBet, setExpandedBet] = useState(null);
  const [betSide, setBetSide] = useState('yes');
  const [betShares, setBetShares] = useState('100');
  const [positions, setPositions] = useState(DEMO_POSITIONS);
  const [markets, setMarkets] = useState(DEMO_MARKETS);

  const getUserPosition = (marketId) => positions.find(p => p.marketId === marketId) || null;

  const activeMarkets = markets.filter(m => !m.resolved);
  const resolvedMarkets = markets.filter(m => m.resolved);
  const filteredMarkets = filter === 'active' ? activeMarkets : resolvedMarkets;
  const totalVolume = markets.reduce((sum, m) => sum + m.yesShares + m.noShares, 0);
  const totalParticipants = markets.reduce((sum, m) => sum + m.totalParticipants, 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="lg:col-span-3">
        <FadeIn>
          <span className="section-label mb-2 block text-neutral-400">Main Track: Prediction Markets & DeFi</span>
          <h2 className="section-title mb-2 italic underline decoration-neutral-200 underline-offset-8">Knowledge Exchange Terminal</h2>
          <p className="body-text text-sm mb-8 font-light max-w-2xl">
            Logarithmic Market Scoring Rule (LMSR) engine providing instant liquidity for research verification. 
            Trade truth probabilities on Flare & Plasma settlement rails.
          </p>
        </FadeIn>

        {/* Stats */}
        <FadeIn delay={0.1}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-neutral-200 border border-neutral-200 mb-8 overflow-hidden">
            {[
              { value: activeMarkets.length, label: 'Active Pairs' },
              { value: `${(totalVolume / 1000).toFixed(1)}k`, label: 'Trading Volume' },
              { value: totalParticipants, label: 'LPs / Traders' },
              { value: resolvedMarkets.length, label: 'Settled' },
            ].map((s, i) => (
              <div key={i} className="bg-white p-4">
                <div className="text-xl font-light tabular-nums">{s.value}</div>
                <div className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">{s.label}</div>
              </div>
            ))}
          </div>
        </FadeIn>

        {/* Filter */}
        <div className="flex gap-1 border-b border-neutral-100 mb-6">
          {['active', 'resolved'].map(f => (
            <button
              key={f}
              className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-all ${filter === f ? 'text-neutral-900 border-b-2 border-neutral-900 -mb-px' : 'text-neutral-400 hover:text-neutral-600'}`}
              onClick={() => setFilter(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Markets */}
        <div className="space-y-4">
          {filteredMarkets.map((market, i) => {
            const yesPrice = lmsrYesPrice(market.yesShares, market.noShares, market.b);
            const noPrice = 1 - yesPrice;
            const yesPercent = Math.round(yesPrice * 100);
            const noPercent = 100 - yesPercent;
            const userPos = getUserPosition(market.id);
            const isExpanded = expandedBet === market.id;

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

                  {/* Pricing Depth Visual */}
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
                      <span className="text-blue-500">PLASMA_USDC</span>
                    </div>
                  </div>

                  {userPos && (
                    <div className={`p-4 mb-4 font-mono text-xs flex justify-between items-center ${userPos.side === 'yes' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                      <div>
                        <span className="opacity-60 mr-2">POSITION:</span>
                        <span className="font-bold">{userPos.side.toUpperCase()} — {userPos.shares} SHARES</span>
                      </div>
                      {market.resolved && ((market.outcome && userPos.side === 'yes') || (!market.outcome && userPos.side === 'no')) && (
                        <Button className="h-7 px-4 bg-neutral-900 text-white text-[10px] rounded-none uppercase" onClick={() => claimPayout(market)}>Settle Payout</Button>
                      )}
                    </div>
                  )}

                  {!market.resolved && !userPos && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="font-mono text-[10px] uppercase tracking-widest h-10 px-8 rounded-none border-neutral-900 hover:bg-neutral-900 hover:text-white transition-all"
                      onClick={() => setExpandedBet(isExpanded ? null : market.id)}
                    >
                      {isExpanded ? 'Cancel Transaction' : 'Open Position'}
                    </Button>
                  )}

                  {isExpanded && (
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
                      <div className="text-[10px] font-mono text-neutral-500 uppercase tracking-tight flex justify-between">
                        <span>Price per share: {(betSide === 'yes' ? yesPrice : noPrice).toFixed(6)}</span>
                        <span>Slippage: {(Math.random() * 0.05).toFixed(3)}%</span>
                      </div>
                      <Button
                        className="w-full bg-neutral-900 text-white hover:bg-neutral-800 h-12 rounded-none font-mono text-xs uppercase tracking-widest"
                        onClick={() => placeBet(market)}
                      >
                        Execute Exchange
                      </Button>
                    </motion.div>
                  )}
                </div>
              </FadeIn>
            );
          })}
        </div>
      </div>

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
                {DEMO_MARKETS[i % 5].question}
              </div>
              <div className="text-[8px] font-mono text-neutral-300 uppercase italic">T-{i+2} mins ago</div>
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
