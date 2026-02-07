import React, { useState } from 'react';

function ReplicationReport({ report }) {
  const [expandedSections, setExpandedSections] = useState({ plan: false, code: false, results: false, review: false, lean: false });

  if (!report) return null;

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const verdictClass = report.verdict?.toLowerCase().includes('unlikely') ? 'unlikely'
    : report.verdict?.toLowerCase().includes('partial') ? 'partial' : 'likely';

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `replication-report-${report.paper?.title?.slice(0, 30).replace(/\s+/g, '-') || 'report'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copySummary = () => {
    const summary = [
      `Replication Report: ${report.paper?.title}`,
      `Verdict: ${report.verdict}`,
      `Feasibility: ${report.feasibilityScore}%`,
      report.overallScore ? `Peer Review Score: ${report.overallScore}/10` : '',
      '',
      `Claims: ${report.claims?.length || 0}`,
      `Plan Steps: ${report.replicationPlan?.length || 0}`,
      report.matchPrediction != null ? `Match Prediction: ${report.matchPrediction}%` : '',
      '',
      `Generated: ${report.generatedAt}`,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(summary);
  };

  return (
    <div className="lab-report">
      <div className="lab-report-header">
        <h3>Replication Report</h3>
        <div className={`lab-report-verdict lab-rv-${verdictClass}`}>
          {report.verdict}
        </div>
      </div>

      <div className="lab-report-scores">
        {report.feasibilityScore != null && (
          <div className="lab-report-score-card">
            <span className="lab-report-score-value">{report.feasibilityScore}%</span>
            <span className="lab-report-score-label">Feasibility</span>
          </div>
        )}
        {report.overallScore != null && (
          <div className="lab-report-score-card">
            <span className="lab-report-score-value">{report.overallScore}/10</span>
            <span className="lab-report-score-label">Peer Review</span>
          </div>
        )}
        {report.matchPrediction != null && (
          <div className="lab-report-score-card">
            <span className="lab-report-score-value">{report.matchPrediction}%</span>
            <span className="lab-report-score-label">Match Rate</span>
          </div>
        )}
        {report.claims?.length > 0 && (
          <div className="lab-report-score-card">
            <span className="lab-report-score-value">{report.claims.length}</span>
            <span className="lab-report-score-label">Claims</span>
          </div>
        )}
      </div>

      {report.claims?.length > 0 && (
        <div className="lab-report-section">
          <h4>Key Claims</h4>
          <ul className="lab-claims-list">
            {report.claims.slice(0, 5).map((c, i) => (
              <li key={i}>
                <span className={`lab-claim-type lab-claim-${c.type}`}>{c.type}</span>
                {c.claim}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="lab-report-collapsible" onClick={() => toggleSection('plan')}>
        <span>Replication Plan ({report.replicationPlan?.length || 0} steps)</span>
        <span>{expandedSections.plan ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expandedSections.plan && report.replicationPlan?.length > 0 && (
        <div className="lab-report-section">
          <ol className="lab-plan-list">
            {report.replicationPlan.map((s, i) => (
              <li key={i}><strong>{s.title}</strong> — {s.description}</li>
            ))}
          </ol>
        </div>
      )}

      <div className="lab-report-collapsible" onClick={() => toggleSection('code')}>
        <span>Python Code</span>
        <span>{expandedSections.code ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expandedSections.code && report.pythonCode && (
        <div className="lab-report-section">
          <pre className="lab-code-block"><code>{report.pythonCode}</code></pre>
        </div>
      )}

      <div className="lab-report-collapsible" onClick={() => toggleSection('results')}>
        <span>Simulated Results</span>
        <span>{expandedSections.results ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expandedSections.results && report.simulatedResults?.length > 0 && (
        <div className="lab-report-section">
          <table className="lab-table lab-table-results">
            <thead><tr><th>Metric</th><th>Original</th><th>Estimated</th><th>Confidence</th></tr></thead>
            <tbody>
              {report.simulatedResults.map((r, i) => (
                <tr key={i}><td>{r.metric}</td><td>{r.original}</td><td>{r.estimated}</td><td>{r.confidence}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="lab-report-collapsible" onClick={() => toggleSection('review')}>
        <span>Peer Review</span>
        <span>{expandedSections.review ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expandedSections.review && report.peerReview && (
        <div className="lab-report-section">
          {report.peerReview.strengths?.length > 0 && (
            <>
              <h4>Strengths</h4>
              <ul className="lab-pros">{report.peerReview.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </>
          )}
          {report.peerReview.weaknesses?.length > 0 && (
            <>
              <h4>Weaknesses</h4>
              <ul className="lab-cons">{report.peerReview.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </>
          )}
          {report.peerReview.recommendations?.length > 0 && (
            <>
              <h4>Recommendations</h4>
              <ul>{report.peerReview.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ul>
            </>
          )}
        </div>
      )}

      {/* Lean Formalization */}
      {report.formalization?.leanCode && (
        <>
          <div className="lab-report-collapsible" onClick={() => toggleSection('lean')}>
            <span>Lean 4 Formalization ({report.formalization.theorems?.length || 0} theorems)</span>
            <span>{expandedSections.lean ? '\u25B2' : '\u25BC'}</span>
          </div>
          {expandedSections.lean && (
            <div className="lab-report-section">
              {report.formalization.formalizationNotes && (
                <p className="lab-output-summary" style={{ margin: '0 0 12px' }}>{report.formalization.formalizationNotes}</p>
              )}
              {report.formalization.theorems?.length > 0 && (
                <>
                  <h4>Theorems</h4>
                  <ul className="lab-claims-list">
                    {report.formalization.theorems.map((t, i) => (
                      <li key={i}>
                        <code style={{ fontWeight: 600, color: '#2B6CB0' }}>{t.name}</code>
                        {' — '}{t.claim}
                        {t.difficulty && <span className={`lab-gap-severity lab-gap-${t.difficulty === 'open_problem' ? 'critical' : t.difficulty === 'hard' ? 'critical' : t.difficulty === 'moderate' ? 'moderate' : 'minor'}`}>{t.difficulty.replace('_', ' ')}</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <pre className="lab-code-block lab-lean-code"><code>{report.formalization.leanCode}</code></pre>
              {report.formalization.mathlibDeps?.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <strong style={{ fontSize: '0.8rem', color: '#666' }}>Mathlib deps: </strong>
                  {report.formalization.mathlibDeps.map((d, i) => <span key={i} className="lab-field-tag" style={{ marginRight: 4 }}>{d}</span>)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="lab-report-actions">
        <button className="btn btn-small lab-export-btn" onClick={exportJSON}>
          Export JSON
        </button>
        <button className="btn btn-small lab-copy-btn" onClick={copySummary}>
          Copy Summary
        </button>
      </div>
    </div>
  );
}

export default ReplicationReport;
