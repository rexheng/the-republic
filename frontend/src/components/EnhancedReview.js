import React, { useState, useCallback } from 'react';
import {
  DIMENSIONS,
  JOURNAL_TIERS,
  createBlankEvaluation,
  computeCompositeScore,
  compositeToOnChain,
  serializeEvaluation,
} from '../utils/evaluation';
import RadarChart from './RadarChart';

function EnhancedReview({ paperId, onSubmit, account }) {
  const [evaluation, setEvaluation] = useState(createBlankEvaluation);
  const [submitting, setSubmitting] = useState(false);
  const [activeSection, setActiveSection] = useState('scores');

  const composite = computeCompositeScore(evaluation.scores);
  const onChainScore = compositeToOnChain(composite);

  // Update a dimension score
  const updateScore = useCallback((dimKey, field, value) => {
    setEvaluation(prev => {
      const current = prev.scores[dimKey];
      const updated = { ...current, [field]: Number(value) };

      // Auto-adjust CI bounds to maintain validity
      if (field === 'midpoint') {
        if (updated.low > updated.midpoint) updated.low = Math.max(0, updated.midpoint - 10);
        if (updated.high < updated.midpoint) updated.high = Math.min(100, updated.midpoint + 10);
      } else if (field === 'low') {
        if (updated.low > updated.midpoint) updated.midpoint = updated.low;
        if (updated.low > updated.high) updated.high = updated.low;
      } else if (field === 'high') {
        if (updated.high < updated.midpoint) updated.midpoint = updated.high;
        if (updated.high < updated.low) updated.low = updated.high;
      }

      return {
        ...prev,
        scores: { ...prev.scores, [dimKey]: updated },
      };
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const serialized = serializeEvaluation(evaluation, account);
      await onSubmit({
        paperId,
        onChainScore,
        evaluationJson: serialized,
        evaluation,
      });
    } catch (e) {
      console.error('Enhanced review submission error:', e);
    }
    setSubmitting(false);
  }, [evaluation, paperId, onChainScore, onSubmit, account]);

  const ciWidth = (dimKey) => {
    const s = evaluation.scores[dimKey];
    return s.high - s.low;
  };

  return (
    <div className="enhanced-review">
      <div className="er-header">
        <h3>Multi-Dimensional Evaluation</h3>
        <p className="er-subtitle">
          Rate each dimension with a score and 90% confidence interval.
          Your certainty matters as much as your score.
        </p>
      </div>

      {/* Section Tabs */}
      <div className="er-sections">
        <button
          className={`er-section-tab ${activeSection === 'scores' ? 'active' : ''}`}
          onClick={() => setActiveSection('scores')}
        >
          Dimension Scores
        </button>
        <button
          className={`er-section-tab ${activeSection === 'predictions' ? 'active' : ''}`}
          onClick={() => setActiveSection('predictions')}
        >
          Predictions
        </button>
        <button
          className={`er-section-tab ${activeSection === 'written' ? 'active' : ''}`}
          onClick={() => setActiveSection('written')}
        >
          Written Review
        </button>
      </div>

      {/* ─── Dimension Scores ───────────────────── */}
      {activeSection === 'scores' && (
        <div className="er-scores-section">
          <div className="er-scores-grid">
            <div className="er-radar-preview">
              <RadarChart evaluations={[evaluation]} size={240} />
              <div className="er-composite-preview">
                <span className="er-composite-num">{composite}</span>
                <span className="er-composite-lbl">composite</span>
              </div>
            </div>

            <div className="er-sliders">
              {DIMENSIONS.map(d => {
                const s = evaluation.scores[d.key];
                const width = ciWidth(d.key);
                return (
                  <div key={d.key} className="er-dim">
                    <div className="er-dim-header">
                      <span className="er-dim-label" style={{ color: d.color }}>{d.label}</span>
                      <span className="er-dim-value">{s.midpoint}</span>
                    </div>
                    <div className="er-dim-desc">{d.description}</div>

                    {/* Main score slider */}
                    <div className="er-slider-row">
                      <span className="er-slider-label">Score</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={s.midpoint}
                        onChange={e => updateScore(d.key, 'midpoint', e.target.value)}
                        className="er-slider"
                        style={{
                          '--thumb-color': d.color,
                          '--track-fill': `${s.midpoint}%`,
                        }}
                      />
                    </div>

                    {/* CI sliders */}
                    <div className="er-ci-row">
                      <div className="er-ci-slider">
                        <span className="er-ci-label">Low</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={s.low}
                          onChange={e => updateScore(d.key, 'low', e.target.value)}
                          className="er-slider er-slider-ci"
                        />
                        <span className="er-ci-val">{s.low}</span>
                      </div>
                      <div className="er-ci-slider">
                        <span className="er-ci-label">High</span>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={s.high}
                          onChange={e => updateScore(d.key, 'high', e.target.value)}
                          className="er-slider er-slider-ci"
                        />
                        <span className="er-ci-val">{s.high}</span>
                      </div>
                      <span className={`er-ci-width ${width <= 20 ? 'narrow' : width >= 50 ? 'wide' : ''}`}>
                        CI: {width}pt {width <= 20 ? '(confident)' : width >= 50 ? '(uncertain)' : ''}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Predictions ────────────────────────── */}
      {activeSection === 'predictions' && (
        <div className="er-predictions-section">
          {/* Replication Probability */}
          <div className="er-pred-block">
            <h4>Replication Probability</h4>
            <p className="er-pred-desc">
              If an independent team attempted to replicate the main findings of this paper
              with adequate resources, what is the probability they would succeed?
            </p>
            <div className="er-replication-slider">
              <input
                type="range"
                min="0"
                max="100"
                value={evaluation.replicationProbability}
                onChange={e => setEvaluation(prev => ({
                  ...prev,
                  replicationProbability: Number(e.target.value),
                }))}
                className="er-slider er-slider-replication"
              />
              <div className="er-replication-display">
                <span className="er-replication-value" style={{
                  color: evaluation.replicationProbability >= 70 ? '#38a169' :
                         evaluation.replicationProbability >= 40 ? '#d69e2e' : '#e53e3e'
                }}>
                  {evaluation.replicationProbability}%
                </span>
                <span className="er-replication-label">
                  {evaluation.replicationProbability >= 80 ? 'Very likely to replicate' :
                   evaluation.replicationProbability >= 60 ? 'Likely to replicate' :
                   evaluation.replicationProbability >= 40 ? 'Uncertain' :
                   evaluation.replicationProbability >= 20 ? 'Unlikely to replicate' :
                   'Very unlikely to replicate'}
                </span>
              </div>
            </div>
          </div>

          {/* Journal Tier — Should vs Will */}
          <div className="er-pred-block">
            <h4>Journal Tier Prediction</h4>
            <p className="er-pred-desc">
              Where <em>should</em> this paper publish based on merit alone?
              And where do you <em>predict</em> it will actually publish?
              The gap reveals systemic bias.
            </p>

            <div className="er-tier-grid">
              <div className="er-tier-col">
                <div className="er-tier-heading">Should Publish (Merit)</div>
                {JOURNAL_TIERS.map(t => (
                  <label key={t.value} className={`er-tier-option ${evaluation.tierShould === t.value ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="tierShould"
                      value={t.value}
                      checked={evaluation.tierShould === t.value}
                      onChange={() => setEvaluation(prev => ({ ...prev, tierShould: t.value }))}
                    />
                    <span className="er-tier-num">{t.value}</span>
                    <span className="er-tier-name">{t.label}</span>
                  </label>
                ))}
              </div>

              <div className="er-tier-col">
                <div className="er-tier-heading">Will Publish (Prediction)</div>
                {JOURNAL_TIERS.map(t => (
                  <label key={t.value} className={`er-tier-option ${evaluation.tierWill === t.value ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="tierWill"
                      value={t.value}
                      checked={evaluation.tierWill === t.value}
                      onChange={() => setEvaluation(prev => ({ ...prev, tierWill: t.value }))}
                    />
                    <span className="er-tier-num">{t.value}</span>
                    <span className="er-tier-name">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {evaluation.tierShould !== evaluation.tierWill && (
              <div className={`er-tier-gap-alert ${evaluation.tierShould > evaluation.tierWill ? 'undervalued' : 'overvalued'}`}>
                {evaluation.tierShould > evaluation.tierWill
                  ? `This paper deserves a higher-tier venue than it will likely get (+${evaluation.tierShould - evaluation.tierWill} tier gap)`
                  : `This paper may be overvalued by the system (${evaluation.tierShould - evaluation.tierWill} tier gap)`
                }
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Written Review ─────────────────────── */}
      {activeSection === 'written' && (
        <div className="er-written-section">
          <div className="form-group">
            <label>Overall Evaluation</label>
            <textarea
              value={evaluation.writtenEvaluation}
              onChange={e => setEvaluation(prev => ({ ...prev, writtenEvaluation: e.target.value }))}
              placeholder="Provide your overall assessment of this paper. Consider the main claims, evidence, and implications..."
              rows={5}
            />
          </div>

          <div className="form-group">
            <label>Key Strengths</label>
            <textarea
              value={evaluation.strengths}
              onChange={e => setEvaluation(prev => ({ ...prev, strengths: e.target.value }))}
              placeholder="What does this paper do well? What are its strongest contributions?"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Key Weaknesses</label>
            <textarea
              value={evaluation.weaknesses}
              onChange={e => setEvaluation(prev => ({ ...prev, weaknesses: e.target.value }))}
              placeholder="What are the main limitations? What could undermine the conclusions?"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Suggestions for Improvement</label>
            <textarea
              value={evaluation.suggestions}
              onChange={e => setEvaluation(prev => ({ ...prev, suggestions: e.target.value }))}
              placeholder="Concrete suggestions for the authors to improve this work..."
              rows={3}
            />
          </div>
        </div>
      )}

      {/* ─── Submit Bar ─────────────────────────── */}
      <div className="er-submit-bar">
        <div className="er-submit-summary">
          <div className="er-submit-composite">
            <span className="er-submit-score">{composite}/100</span>
            <span className="er-submit-onchain">On-chain: {onChainScore}/10</span>
          </div>
          <div className="er-submit-meta">
            Replication: {evaluation.replicationProbability}%
            &nbsp;&middot;&nbsp;
            Tier: {evaluation.tierShould}/5 (merit)
          </div>
        </div>
        <button
          className="btn btn-primary er-submit-btn"
          onClick={handleSubmit}
          disabled={submitting || !evaluation.writtenEvaluation.trim()}
        >
          {submitting ? 'Submitting...' : 'Submit Evaluation (Earn $100 USDC)'}
        </button>
        {!evaluation.writtenEvaluation.trim() && (
          <span className="er-submit-hint">Written evaluation required</span>
        )}
      </div>
    </div>
  );
}

export default EnhancedReview;
