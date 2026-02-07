import React, { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import EnhancedReview from './EnhancedReview';
import EvaluationDisplay from './EvaluationDisplay';

function ReviewPanel({ contracts, account }) {
  const [papers, setPapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedPaper, setExpandedPaper] = useState(null);
  const [isReviewer, setIsReviewer] = useState(false);
  const [stakeAmount, setStakeAmount] = useState('100');
  // Store evaluations keyed by paperId — in production this would come from IPFS
  const [evaluationsMap, setEvaluationsMap] = useState({});

  const loadPapersForReview = useCallback(async () => {
    if (!contracts.researchGraph) return;

    try {
      setLoading(true);
      const count = await contracts.researchGraph.paperCount();
      const loadedPapers = [];

      for (let i = 1; i <= Number(count); i++) {
        try {
          const paper = await contracts.researchGraph.getPaper(i);
          if (Number(paper.status) === 1) {
            const reviewers = await contracts.researchGraph.getPaperReviewers(i);
            loadedPapers.push({
              id: Number(paper.id),
              author: paper.author,
              ipfsHash: paper.ipfsHash,
              doi: paper.doi,
              reviewers: reviewers,
              isAssigned: reviewers.some(r => r.toLowerCase() === account.toLowerCase()),
            });
          }
        } catch (e) {
          // Paper might not exist
        }
      }

      setPapers(loadedPapers);
    } catch (error) {
      console.error('Error loading papers:', error);
    } finally {
      setLoading(false);
    }
  }, [contracts.researchGraph, account]);

  useEffect(() => {
    loadPapersForReview();
  }, [loadPapersForReview]);

  const registerAsReviewer = async () => {
    try {
      const amount = ethers.parseEther(stakeAmount);

      const approveTx = await contracts.researchToken.approve(
        await contracts.researchGraph.getAddress(),
        amount
      );
      await approveTx.wait();

      const registerTx = await contracts.researchGraph.registerAsReviewer(amount);
      await registerTx.wait();

      alert('Successfully registered as reviewer!');
      setIsReviewer(true);
    } catch (error) {
      console.error('Registration error:', error);
      alert('Failed to register: ' + (error.reason || error.message));
    }
  };

  const handleEnhancedSubmit = async ({ paperId, onChainScore, evaluationJson, evaluation }) => {
    try {
      // The evaluationJson would go to IPFS in production
      // For demo, we use a mock hash that encodes the composite score
      const mockIpfsHash = 'QmEval' + Math.random().toString(36).substring(7);

      const tx = await contracts.researchGraph.submitReview(
        paperId,
        onChainScore,
        mockIpfsHash
      );
      await tx.wait();

      // Store evaluation locally (in production: fetch from IPFS)
      setEvaluationsMap(prev => ({
        ...prev,
        [paperId]: [...(prev[paperId] || []), evaluation],
      }));

      setExpandedPaper(null);
      alert(`Evaluation submitted! Composite score: ${onChainScore}/10 on-chain. You will receive $100 USDC via Plasma.`);
      loadPapersForReview();
    } catch (error) {
      console.error('Review submission error:', error);
      alert('Failed to submit review: ' + (error.reason || error.message));
    }
  };

  if (loading) {
    return <div className="loading">Loading papers for review</div>;
  }

  return (
    <div>
      <h2>Evaluate Research</h2>
      <p style={{ color: '#666', marginBottom: '10px' }}>
        Multi-dimensional evaluation with confidence intervals, replication prediction, and journal tier forecasting.
      </p>
      <p style={{ color: '#999', fontSize: '0.85rem', marginBottom: '30px' }}>
        Inspired by The Unjournal's open evaluation model — enhanced with Bayesian aggregation and quantified uncertainty.
      </p>

      {!isReviewer && (
        <div style={{
          background: '#fff3e0',
          padding: '20px',
          borderRadius: '12px',
          marginBottom: '30px',
          border: '2px solid #f57c00'
        }}>
          <h3 style={{ marginBottom: '15px' }}>Become a Reviewer</h3>
          <p style={{ color: '#666', marginBottom: '15px' }}>
            Stake RESEARCH tokens to become a reviewer. Your stake ensures review quality and can be slashed for poor reviews.
          </p>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
              <label>Stake Amount (RESEARCH tokens)</label>
              <input
                type="number"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                min="100"
                step="10"
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={registerAsReviewer}
            >
              Register as Reviewer
            </button>
          </div>
        </div>
      )}

      <h3 style={{ marginBottom: '20px' }}>Papers Under Review ({papers.length})</h3>

      {papers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <div style={{ fontSize: '3rem', marginBottom: '15px' }}>&#9997;&#65039;</div>
          <p>No papers currently under review</p>
        </div>
      ) : (
        <div>
          {papers.map((paper) => (
            <div key={paper.id} className="paper-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div className="paper-title">Paper #{paper.id}</div>
                  {paper.doi && (
                    <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
                      DOI: {paper.doi}
                    </div>
                  )}
                  <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px', fontFamily: 'monospace' }}>
                    IPFS: {paper.ipfsHash}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  {paper.isAssigned && (
                    <span style={{
                      background: '#4caf50',
                      color: 'white',
                      padding: '5px 12px',
                      borderRadius: '20px',
                      fontSize: '0.85rem'
                    }}>
                      Assigned to You
                    </span>
                  )}
                </div>
              </div>

              {/* Show existing evaluations */}
              {evaluationsMap[paper.id]?.length > 0 && (
                <div style={{ marginTop: '15px' }}>
                  <EvaluationDisplay evaluations={evaluationsMap[paper.id]} compact />
                </div>
              )}

              {paper.isAssigned && expandedPaper !== paper.id && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '15px', width: '100%' }}
                  onClick={() => setExpandedPaper(paper.id)}
                >
                  Start Evaluation
                </button>
              )}

              {paper.isAssigned && expandedPaper === paper.id && (
                <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #f0f0f0' }}>
                  <EnhancedReview
                    paperId={paper.id}
                    onSubmit={handleEnhancedSubmit}
                    account={account}
                  />
                </div>
              )}

              {!paper.isAssigned && (
                <div style={{
                  marginTop: '15px',
                  padding: '10px',
                  background: '#f5f5f5',
                  borderRadius: '6px',
                  fontSize: '0.9rem',
                  color: '#666'
                }}>
                  This paper is assigned to other reviewers via Flare's Random Number Generator
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Demo Mode: Show evaluation system with sample data */}
      <div style={{
        marginTop: '40px',
        padding: '25px',
        background: '#f8f9ff',
        borderRadius: '12px',
        border: '2px solid #e8eaff'
      }}>
        <h3 style={{ marginBottom: '10px' }}>Evaluation System Demo</h3>
        <p style={{ color: '#666', marginBottom: '20px', fontSize: '0.9rem' }}>
          This shows how aggregated evaluations look with multiple reviewers.
          Bayesian precision-weighting means confident reviewers count more.
        </p>
        <EvaluationDisplay evaluations={DEMO_EVALUATIONS} />
      </div>
    </div>
  );
}

// Sample evaluations for demo display
const DEMO_EVALUATIONS = [
  {
    scores: {
      overall: { midpoint: 82, low: 75, high: 90 },
      novelty: { midpoint: 90, low: 85, high: 95 },
      methodology: { midpoint: 75, low: 60, high: 85 },
      reproducibility: { midpoint: 70, low: 55, high: 80 },
      clarity: { midpoint: 85, low: 78, high: 92 },
      impact: { midpoint: 95, low: 88, high: 99 },
    },
    replicationProbability: 65,
    tierShould: 5,
    tierWill: 4,
    writtenEvaluation: 'Groundbreaking architecture that fundamentally changed how we approach sequence modeling. The self-attention mechanism is elegant and well-motivated.',
    strengths: 'Novel architecture with clear theoretical motivation. Excellent empirical results across multiple benchmarks.',
    weaknesses: 'Limited analysis of failure modes. Computational cost scaling not fully explored.',
  },
  {
    scores: {
      overall: { midpoint: 78, low: 65, high: 88 },
      novelty: { midpoint: 85, low: 70, high: 93 },
      methodology: { midpoint: 80, low: 72, high: 88 },
      reproducibility: { midpoint: 60, low: 40, high: 75 },
      clarity: { midpoint: 82, low: 75, high: 90 },
      impact: { midpoint: 88, low: 78, high: 95 },
    },
    replicationProbability: 58,
    tierShould: 4,
    tierWill: 4,
    writtenEvaluation: 'Strong contribution with impressive results. Some concerns about reproducibility given the scale of compute required.',
    strengths: 'Clean formulation of attention. Strong ablation studies.',
    weaknesses: 'Reproducibility concerns due to compute requirements. Some claims about universality are overstated.',
  },
  {
    scores: {
      overall: { midpoint: 88, low: 82, high: 94 },
      novelty: { midpoint: 92, low: 88, high: 97 },
      methodology: { midpoint: 82, low: 74, high: 90 },
      reproducibility: { midpoint: 75, low: 65, high: 85 },
      clarity: { midpoint: 90, low: 85, high: 95 },
      impact: { midpoint: 96, low: 92, high: 99 },
    },
    replicationProbability: 72,
    tierShould: 5,
    tierWill: 5,
    writtenEvaluation: 'One of the most important papers in the last decade. The Transformer architecture has become the foundation for virtually all modern AI systems.',
    strengths: 'Paradigm-shifting architecture. Exceptional clarity of writing. Results speak for themselves.',
    weaknesses: 'Could have explored theoretical properties more deeply. Limited discussion of societal implications.',
  },
];

export default ReviewPanel;
