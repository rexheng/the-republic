import React from 'react';
import { DIMENSIONS, JOURNAL_TIERS, aggregateEvaluations, confidenceGrade } from '../utils/evaluation';
import RadarChart from './RadarChart';

// Displays aggregated evaluation results for a paper
// Better than Unjournal: visual radar chart, Bayesian aggregation, confidence grades

function EvaluationDisplay({ evaluations, compact = false }) {
  if (!evaluations || evaluations.length === 0) {
    return compact ? null : (
      <div className="eval-empty">
        <p>No evaluations yet</p>
      </div>
    );
  }

  const agg = aggregateEvaluations(evaluations);
  if (!agg) return null;

  const grade = confidenceGrade(
    Object.values(agg.dimensions).reduce((sum, d) => sum + d.confidence, 0) / DIMENSIONS.length
  );

  // Compact mode for knowledge graph sidebar
  if (compact) {
    return (
      <div className="eval-compact">
        <div className="eval-compact-header">
          <div className="eval-composite-badge" style={{ borderColor: grade.color }}>
            <span className="eval-composite-score">{agg.composite}</span>
            <span className="eval-composite-label">/100</span>
          </div>
          <div className="eval-compact-meta">
            <span className="eval-reviewer-count">{agg.reviewCount} review{agg.reviewCount !== 1 ? 's' : ''}</span>
            <span className="eval-confidence-badge" style={{ color: grade.color }}>
              {grade.label} confidence
            </span>
          </div>
        </div>
        <div className="eval-compact-bars">
          {DIMENSIONS.map(d => (
            <div key={d.key} className="eval-bar-row">
              <span className="eval-bar-label" style={{ color: d.color }}>{d.short}</span>
              <div className="eval-bar-track">
                {/* CI range */}
                <div
                  className="eval-bar-ci"
                  style={{
                    left: `${agg.dimensions[d.key].low}%`,
                    width: `${agg.dimensions[d.key].high - agg.dimensions[d.key].low}%`,
                    background: d.color + '30',
                  }}
                />
                {/* Midpoint */}
                <div
                  className="eval-bar-fill"
                  style={{
                    width: `${agg.dimensions[d.key].midpoint}%`,
                    background: d.color,
                  }}
                />
              </div>
              <span className="eval-bar-value">{agg.dimensions[d.key].midpoint}</span>
            </div>
          ))}
        </div>
        {agg.replicationProbability != null && (
          <div className="eval-replication-compact">
            Replication probability: <strong>{agg.replicationProbability}%</strong>
          </div>
        )}
      </div>
    );
  }

  // Full display mode
  return (
    <div className="eval-full">
      <div className="eval-header">
        <h3>Evaluation Summary</h3>
        <div className="eval-header-meta">
          <span className="eval-reviewer-count">{agg.reviewCount} evaluation{agg.reviewCount !== 1 ? 's' : ''}</span>
          <span className="eval-confidence-pill" style={{ background: grade.color + '20', color: grade.color }}>
            {grade.label} Confidence
          </span>
        </div>
      </div>

      <div className="eval-main-grid">
        {/* Left: Radar Chart */}
        <div className="eval-radar-section">
          <RadarChart evaluations={evaluations} aggregate={agg.dimensions} />
          <div className="eval-composite-large">
            <div className="eval-composite-ring" style={{ borderColor: grade.color }}>
              <span className="eval-composite-number">{agg.composite}</span>
              <span className="eval-composite-of">/100</span>
            </div>
            <span className="eval-composite-text">Composite Score</span>
          </div>
        </div>

        {/* Right: Dimension breakdown */}
        <div className="eval-dimensions">
          {DIMENSIONS.map(d => {
            const dim = agg.dimensions[d.key];
            return (
              <div key={d.key} className="eval-dim-row">
                <div className="eval-dim-header">
                  <span className="eval-dim-name" style={{ color: d.color }}>{d.label}</span>
                  <span className="eval-dim-score">{dim.midpoint}</span>
                </div>
                <div className="eval-dim-bar-container">
                  <div className="eval-dim-bar-bg">
                    <div
                      className="eval-dim-bar-ci"
                      style={{
                        left: `${dim.low}%`,
                        width: `${dim.high - dim.low}%`,
                        background: d.color + '25',
                      }}
                    />
                    <div
                      className="eval-dim-bar-fill"
                      style={{ width: `${dim.midpoint}%`, background: d.color }}
                    />
                  </div>
                </div>
                <div className="eval-dim-ci">
                  90% CI: [{dim.low}, {dim.high}]
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Predictions Row */}
      <div className="eval-predictions">
        <div className="eval-pred-card">
          <div className="eval-pred-label">Replication Probability</div>
          <div className="eval-pred-value" style={{
            color: agg.replicationProbability >= 70 ? '#38a169' :
                   agg.replicationProbability >= 40 ? '#d69e2e' : '#e53e3e'
          }}>
            {agg.replicationProbability != null ? `${agg.replicationProbability}%` : '—'}
          </div>
          <div className="eval-pred-bar">
            <div
              className="eval-pred-bar-fill"
              style={{
                width: `${agg.replicationProbability || 0}%`,
                background: agg.replicationProbability >= 70 ? '#38a169' :
                            agg.replicationProbability >= 40 ? '#d69e2e' : '#e53e3e',
              }}
            />
          </div>
        </div>

        <div className="eval-pred-card">
          <div className="eval-pred-label">Should Publish At</div>
          <div className="eval-pred-value eval-pred-tier">
            {JOURNAL_TIERS[Math.round(agg.tierShould)]?.label || '—'}
          </div>
          <div className="eval-pred-sublabel">Tier {agg.tierShould.toFixed(1)}/5 (merit)</div>
        </div>

        <div className="eval-pred-card">
          <div className="eval-pred-label">Will Publish At</div>
          <div className="eval-pred-value eval-pred-tier">
            {JOURNAL_TIERS[Math.round(agg.tierWill)]?.label || '—'}
          </div>
          <div className="eval-pred-sublabel">Tier {agg.tierWill.toFixed(1)}/5 (prediction)</div>
        </div>

        {agg.tierGap !== 0 && (
          <div className="eval-pred-card eval-pred-gap">
            <div className="eval-pred-label">Merit-Publication Gap</div>
            <div className="eval-pred-value" style={{
              color: agg.tierGap > 0 ? '#e53e3e' : '#38a169'
            }}>
              {agg.tierGap > 0 ? '+' : ''}{agg.tierGap.toFixed(1)}
            </div>
            <div className="eval-pred-sublabel">
              {agg.tierGap > 0 ? 'Undervalued by system' : 'Fairly valued'}
            </div>
          </div>
        )}
      </div>

      {/* Individual Reviews */}
      {evaluations.length > 1 && (
        <div className="eval-individuals">
          <h4>Individual Evaluations</h4>
          <div className="eval-individual-list">
            {evaluations.map((ev, i) => (
              <div key={i} className="eval-individual-card">
                <div className="eval-individual-header">
                  <span className="eval-individual-name">Reviewer {i + 1}</span>
                  <span className="eval-individual-composite">
                    {Object.values(ev.scores).reduce((sum, s) => sum + (s.midpoint || 0), 0) /
                      Math.max(Object.keys(ev.scores).length, 1)
                    |0}/100
                  </span>
                </div>
                {ev.writtenEvaluation && (
                  <p className="eval-individual-text">{ev.writtenEvaluation}</p>
                )}
                {ev.strengths && (
                  <div className="eval-individual-section">
                    <strong>Strengths:</strong> {ev.strengths}
                  </div>
                )}
                {ev.weaknesses && (
                  <div className="eval-individual-section">
                    <strong>Weaknesses:</strong> {ev.weaknesses}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default EvaluationDisplay;
