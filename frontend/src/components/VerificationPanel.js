import React, { useState } from 'react';

const HEALTH_COLORS = { healthy: '#38a169', warning: '#d69e2e', critical: '#e53e3e' };
const VERDICT_COLORS = {
  novel: '#38a169', incremental: '#d69e2e', known: '#e53e3e',
  strong: '#38a169', moderate: '#d69e2e', weak: '#e53e3e', unsupported: '#e53e3e',
  feasible: '#38a169', challenging: '#d69e2e', infeasible: '#e53e3e',
};

function Gauge({ label, value, color }) {
  return (
    <div className="ralph-gauge">
      <div className="ralph-gauge-label">{label}</div>
      <div className="ralph-gauge-track">
        <div
          className="ralph-gauge-fill"
          style={{ width: `${Math.min(100, value)}%`, background: color || '#667eea' }}
        />
      </div>
      <span className="ralph-gauge-value">{value}%</span>
    </div>
  );
}

function VerdictBadge({ verdict }) {
  const color = VERDICT_COLORS[verdict] || '#a0aec0';
  return (
    <span className="ralph-vb" style={{ color, background: color + '18', borderColor: color + '40' }}>
      {verdict}
    </span>
  );
}

function VerificationPanel({ verification }) {
  const [expanded, setExpanded] = useState({
    hypothesis: false, source: false, loop: false,
  });

  if (!verification) return null;

  const { hypothesisVerification: hv, sourceVerification: sv, loopQuality: lq } = verification;
  const overallHealth = lq?.overallHealth || 'healthy';
  const alerts = lq?.alerts || [];

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="ralph-verification">
      <div className="ralph-verify-header">
        <span className="ralph-verify-icon">{'\uD83D\uDEE1\uFE0F'}</span>
        <span>Verification Results</span>
        <span className="ralph-health-badge" style={{ background: HEALTH_COLORS[overallHealth] }}>
          {overallHealth}
        </span>
      </div>

      {/* Gauges */}
      <div className="ralph-verify-gauges">
        {hv && <Gauge label="Novelty" value={hv.overallNoveltyScore || 0} color="#667eea" />}
        {sv && <Gauge label="Trust" value={sv.overallTrust || 0} color="#38a169" />}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="ralph-verify-alerts">
          {alerts.map((a, i) => (
            <div key={i} className={`ralph-alert ralph-alert-${a.severity}`}>
              {a.severity === 'critical' ? '\u26A0' : '\u26A0'} {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Hypothesis Verification */}
      {hv && (
        <>
          <div className="lab-report-collapsible" onClick={() => toggle('hypothesis')}>
            <span>Hypothesis Verification ({hv.assessments?.length || 0} checked, {hv.flaggedHypotheses?.length || 0} flagged)</span>
            <span>{expanded.hypothesis ? '\u25B2' : '\u25BC'}</span>
          </div>
          {expanded.hypothesis && (
            <div className="ralph-verify-section">
              {hv.summary && <p className="ralph-verify-summary">{hv.summary}</p>}
              {(hv.assessments || []).map((a, i) => (
                <div key={i} className="ralph-verify-assessment">
                  <div className="ralph-verify-hyp-title">
                    {a.hypothesisId !== undefined ? `H${a.hypothesisId + 1}` : `H${i + 1}`}
                    {a.confidence != null && <span className="ralph-verify-conf">{a.confidence}% conf</span>}
                  </div>
                  <div className="ralph-verify-verdicts">
                    <span>Novelty: <VerdictBadge verdict={a.novelty?.verdict || 'unknown'} /></span>
                    <span>Evidence: <VerdictBadge verdict={a.evidenceSupport?.verdict || 'unknown'} /></span>
                    <span>Feasibility: <VerdictBadge verdict={a.feasibility?.verdict || 'unknown'} /></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Source Verification */}
      {sv && (
        <>
          <div className="lab-report-collapsible" onClick={() => toggle('source')}>
            <span>Source Verification (Trust: {sv.overallTrust}%, {sv.hallucinationFlags?.length || 0} flags)</span>
            <span>{expanded.source ? '\u25B2' : '\u25BC'}</span>
          </div>
          {expanded.source && (
            <div className="ralph-verify-section">
              <div className="ralph-verify-metrics">
                <span>Field Alignment: {sv.paperFieldAlignment?.score ?? '?'}%</span>
                <span>Gap Relevance: {sv.gapRelevance?.score ?? '?'}%</span>
              </div>
              {sv.hallucinationFlags?.length > 0 && (
                <div className="ralph-verify-flags">
                  {sv.hallucinationFlags.map((f, i) => (
                    <div key={i} className={`ralph-flag ralph-flag-${f.severity}`}>
                      <strong>{f.claim}</strong>
                      <span>{f.issue}</span>
                    </div>
                  ))}
                </div>
              )}
              {sv.gapRelevance?.unreferenced?.length > 0 && (
                <div className="ralph-verify-unreferenced">
                  <strong>Unreferenced gaps:</strong>
                  <ul>{sv.gapRelevance.unreferenced.map((g, i) => <li key={i}>{g}</li>)}</ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Loop Health */}
      {lq && (
        <>
          <div className="lab-report-collapsible" onClick={() => toggle('loop')}>
            <span>Loop Health ({lq.overallHealth})</span>
            <span>{expanded.loop ? '\u25B2' : '\u25BC'}</span>
          </div>
          {expanded.loop && (
            <div className="ralph-verify-section">
              <div className="ralph-verify-metrics">
                <span>Novelty Trend: {lq.noveltyTrend}</span>
                <span>Query Diversity: {lq.queryDiversity}%</span>
                <span>Field Coverage: {lq.fieldCoverage}</span>
                <span>Hypothesis Dupes: {lq.duplicateCount || 0}</span>
                <span>Queue: {lq.queueHealth}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default VerificationPanel;
