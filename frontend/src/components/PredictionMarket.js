import React, { useState, useCallback } from 'react';
import { ethers } from 'ethers';

const DEMO_MARKETS = [
  {
    id: 1,
    paperId: 1,
    paperTitle: 'Attention Is All You Need',
    question: 'Will Transformers remain the dominant architecture through 2027?',
    yesPool: 45600,
    noPool: 4000,
    totalParticipants: 142,
    endTime: Date.now() + 86400000 * 45,
    resolved: false,
    outcome: false,
  },
  {
    id: 2,
    paperId: 5,
    paperTitle: 'Generative Adversarial Networks',
    question: 'Will GANs outperform diffusion models on FID scores by end of 2026?',
    yesPool: 12300,
    noPool: 10100,
    totalParticipants: 89,
    endTime: Date.now() + 86400000 * 120,
    resolved: false,
    outcome: false,
  },
  {
    id: 3,
    paperId: 8,
    paperTitle: 'Denoising Diffusion Probabilistic Models',
    question: 'Can DDPM FID scores be replicated within 10% on standard hardware?',
    yesPool: 28400,
    noPool: 6200,
    totalParticipants: 67,
    endTime: Date.now() + 86400000 * 30,
    resolved: false,
    outcome: false,
  },
  {
    id: 4,
    paperId: 12,
    paperTitle: 'Mastering the Game of Go',
    question: 'Were AlphaGo win rates accurately measured in the original study?',
    yesPool: 38900,
    noPool: 2500,
    totalParticipants: 203,
    endTime: Date.now() - 86400000 * 10,
    resolved: true,
    outcome: true,
  },
  {
    id: 5,
    paperId: 3,
    paperTitle: 'Chain-of-Thought Prompting',
    question: 'Does CoT prompting improve GSM8K accuracy by more than 15%?',
    yesPool: 18700,
    noPool: 8800,
    totalParticipants: 54,
    endTime: Date.now() + 86400000 * 60,
    resolved: false,
    outcome: false,
  },
  {
    id: 6,
    paperId: 15,
    paperTitle: 'Sparks of AGI: GPT-4 Experiments',
    question: 'Will key claims be validated by 3+ independent research groups?',
    yesPool: 5200,
    noPool: 12100,
    totalParticipants: 178,
    endTime: Date.now() - 86400000 * 5,
    resolved: true,
    outcome: false,
  },
];

const DEMO_POSITIONS = [
  { marketId: 1, position: true, amount: 500, timestamp: Date.now() - 86400000 * 3 },
  { marketId: 3, position: true, amount: 200, timestamp: Date.now() - 86400000 * 1 },
];

function PredictionMarket({ contracts, account }) {
  const [filter, setFilter] = useState('active');
  const [expandedBet, setExpandedBet] = useState(null);
  const [betSide, setBetSide] = useState(true);
  const [betAmount, setBetAmount] = useState('100');
  const [positions, setPositions] = useState(DEMO_POSITIONS);
  const [markets, setMarkets] = useState(DEMO_MARKETS);

  const activeMarkets = markets.filter(m => !m.resolved);
  const resolvedMarkets = markets.filter(m => m.resolved);
  const filteredMarkets = filter === 'active' ? activeMarkets : resolvedMarkets;

  const totalStaked = markets.reduce((sum, m) => sum + m.yesPool + m.noPool, 0);
  const totalParticipants = markets.reduce((sum, m) => sum + m.totalParticipants, 0);

  const getYesPercent = (m) => {
    const total = m.yesPool + m.noPool;
    if (total === 0) return 50;
    return Math.round((m.yesPool / total) * 100);
  };

  const getTimeRemaining = (endTime) => {
    const diff = endTime - Date.now();
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / 86400000);
    if (days > 0) return `${days}d remaining`;
    const hours = Math.floor(diff / 3600000);
    return `${hours}h remaining`;
  };

  const calculatePotentialPayout = useCallback((market, side, amount) => {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) return 0;
    const totalPool = market.yesPool + market.noPool + amt;
    const winningPool = side ? (market.yesPool + amt) : (market.noPool + amt);
    return ((amt * totalPool) / winningPool).toFixed(0);
  }, []);

  const placeBet = async (market) => {
    const amount = parseFloat(betAmount);
    if (!amount || amount <= 0) return;

    // Try on-chain first
    if (contracts.predictionMarket && contracts.researchToken) {
      try {
        const weiAmount = ethers.parseEther(betAmount);
        const approveTx = await contracts.researchToken.approve(
          await contracts.predictionMarket.getAddress(),
          weiAmount
        );
        await approveTx.wait();
        const stakeTx = await contracts.predictionMarket.stake(market.id, betSide, weiAmount);
        await stakeTx.wait();
        alert(`Staked ${betAmount} RESEARCH on ${betSide ? 'YES' : 'NO'}!`);
      } catch (error) {
        console.error('On-chain bet failed:', error);
        alert('On-chain transaction failed: ' + (error.reason || error.message));
        return;
      }
    }

    // Update demo state
    setMarkets(prev => prev.map(m => {
      if (m.id !== market.id) return m;
      return {
        ...m,
        yesPool: betSide ? m.yesPool + amount : m.yesPool,
        noPool: !betSide ? m.noPool + amount : m.noPool,
        totalParticipants: m.totalParticipants + 1,
      };
    }));

    setPositions(prev => [...prev, {
      marketId: market.id,
      position: betSide,
      amount,
      timestamp: Date.now(),
    }]);

    setExpandedBet(null);
    setBetAmount('100');
  };

  const claimPayout = async (market) => {
    if (contracts.predictionMarket) {
      try {
        const tx = await contracts.predictionMarket.claimPayout(market.id);
        await tx.wait();
        alert('Payout claimed!');
      } catch (error) {
        console.error('Claim failed:', error);
      }
    }

    setPositions(prev => prev.filter(p => p.marketId !== market.id));
  };

  const getUserPosition = (marketId) => positions.find(p => p.marketId === marketId);

  return (
    <div className="pm-container">
      <div className="pm-header">
        <h2>Prediction Markets</h2>
        <p className="pm-subtitle">Polymarket for Science — stake RESEARCH tokens on paper replication outcomes</p>
      </div>

      {/* Stats Row */}
      <div className="pm-stats-row">
        <div className="pm-stat-card">
          <div className="pm-stat-value">{activeMarkets.length}</div>
          <div className="pm-stat-label">Active Markets</div>
        </div>
        <div className="pm-stat-card">
          <div className="pm-stat-value">{(totalStaked / 1000).toFixed(1)}k</div>
          <div className="pm-stat-label">Total Staked</div>
        </div>
        <div className="pm-stat-card">
          <div className="pm-stat-value">{totalParticipants}</div>
          <div className="pm-stat-label">Participants</div>
        </div>
        <div className="pm-stat-card">
          <div className="pm-stat-value">{resolvedMarkets.length}</div>
          <div className="pm-stat-label">Resolved</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="er-sections" style={{ marginBottom: 25 }}>
        <button
          className={`er-section-tab ${filter === 'active' ? 'active' : ''}`}
          onClick={() => setFilter('active')}
        >
          Active ({activeMarkets.length})
        </button>
        <button
          className={`er-section-tab ${filter === 'resolved' ? 'active' : ''}`}
          onClick={() => setFilter('resolved')}
        >
          Resolved ({resolvedMarkets.length})
        </button>
      </div>

      {/* Market Cards */}
      <div className="pm-markets">
        {filteredMarkets.map(market => {
          const yesPercent = getYesPercent(market);
          const noPercent = 100 - yesPercent;
          const userPos = getUserPosition(market.id);
          const isExpanded = expandedBet === market.id;

          return (
            <div key={market.id} className="pm-market-card">
              <div className="pm-market-header">
                <div className="pm-market-paper">{market.paperTitle}</div>
                {market.resolved && (
                  <span className={`pm-resolved-badge ${market.outcome ? 'yes' : 'no'}`}>
                    {market.outcome ? 'YES' : 'NO'}
                  </span>
                )}
              </div>

              <div className="pm-market-question">{market.question}</div>

              {/* Odds Bar */}
              <div className="pm-odds-container">
                <div className="pm-odds-labels">
                  <span className="pm-odds-yes">YES {yesPercent}%</span>
                  <span className="pm-odds-no">{noPercent}% NO</span>
                </div>
                <div className="pm-odds-bar">
                  <div
                    className="pm-odds-bar-yes"
                    style={{ width: `${yesPercent}%` }}
                  />
                  <div
                    className="pm-odds-bar-no"
                    style={{ width: `${noPercent}%` }}
                  />
                </div>
              </div>

              {/* Meta Row */}
              <div className="pm-market-meta">
                <span>{((market.yesPool + market.noPool) / 1000).toFixed(1)}k RESEARCH staked</span>
                <span>{market.totalParticipants} participants</span>
                <span>{getTimeRemaining(market.endTime)}</span>
              </div>

              {/* User Position */}
              {userPos && (
                <div className={`pm-position-indicator ${userPos.position ? 'yes' : 'no'}`}>
                  Your position: {userPos.position ? 'YES' : 'NO'} &mdash; {userPos.amount} RESEARCH
                  {market.resolved && market.outcome === userPos.position && (
                    <button className="pm-claim-btn" onClick={() => claimPayout(market)}>
                      Claim Payout
                    </button>
                  )}
                </div>
              )}

              {/* Place Bet Button */}
              {!market.resolved && !userPos && (
                <button
                  className="pm-bet-toggle"
                  onClick={() => setExpandedBet(isExpanded ? null : market.id)}
                >
                  {isExpanded ? 'Cancel' : 'Place Bet'}
                </button>
              )}

              {/* Inline Bet Panel */}
              {isExpanded && (
                <div className="pm-bet-panel">
                  <div className="pm-bet-sides">
                    <button
                      className={`pm-bet-side-btn ${betSide ? 'active-yes' : ''}`}
                      onClick={() => setBetSide(true)}
                    >
                      YES
                    </button>
                    <button
                      className={`pm-bet-side-btn ${!betSide ? 'active-no' : ''}`}
                      onClick={() => setBetSide(false)}
                    >
                      NO
                    </button>
                  </div>
                  <div className="pm-bet-input-row">
                    <input
                      type="number"
                      className="pm-bet-input"
                      value={betAmount}
                      onChange={(e) => setBetAmount(e.target.value)}
                      placeholder="Amount"
                      min="1"
                    />
                    <span className="pm-bet-token">RESEARCH</span>
                  </div>
                  <div className="pm-bet-payout">
                    Potential payout: <strong>{calculatePotentialPayout(market, betSide, betAmount)} RESEARCH</strong>
                  </div>
                  <button className="pm-bet-confirm" onClick={() => placeBet(market)}>
                    Confirm {betSide ? 'YES' : 'NO'} Bet
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Your Positions */}
      {positions.length > 0 && (
        <div className="pm-positions-section">
          <h3>Your Positions</h3>
          <div className="pm-positions-grid">
            {positions.map(pos => {
              const market = markets.find(m => m.id === pos.marketId);
              if (!market) return null;
              const payout = calculatePotentialPayout(market, pos.position, pos.amount);
              return (
                <div key={pos.marketId} className="pm-position-card">
                  <div className="pm-position-paper">{market.paperTitle}</div>
                  <div className="pm-position-details">
                    <span className={`pm-position-side ${pos.position ? 'yes' : 'no'}`}>
                      {pos.position ? 'YES' : 'NO'}
                    </span>
                    <span className="pm-position-amount">{pos.amount} RESEARCH</span>
                    <span className="pm-position-payout">Payout: ~{payout}</span>
                  </div>
                  {market.resolved && market.outcome === pos.position && (
                    <button className="pm-claim-btn" onClick={() => claimPayout(market)}>
                      Claim Payout
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default PredictionMarket;
