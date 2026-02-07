import React, { useState } from 'react';

function FrontierReport({ report }) {
  const [expandedSections, setExpandedSections] = useState({
    gaps: false, hypotheses: false, connections: false, experiments: false, lean: false,
  });

  if (!report) return null;

  const toggleSection = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const titleSlug = report.papers?.[0]?.title?.slice(0, 30).replace(/\s+/g, '-') || 'frontier';
    a.download = `frontier-proposal-${titleSlug}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copySummary = () => {
    const paperTitles = (report.papers || []).map(p => p.title).join(', ');
    const summary = [
      `Frontier Research Proposal`,
      `Papers: ${paperTitles}`,
      `Novelty Score: ${report.noveltyScore}%`,
      '',
      `Gaps Found: ${report.stats?.gapCount || 0}`,
      `Hypotheses Proposed: ${report.stats?.hypothesisCount || 0}`,
      `Fields Connected: ${report.stats?.connectionCount || 0}`,
      `Experiments Designed: ${report.stats?.experimentCount || 0}`,
      '',
      report.summaries?.nova ? `Frontier: ${report.summaries.nova}` : '',
      report.summaries?.eureka ? `Hypotheses: ${report.summaries.eureka}` : '',
      report.summaries?.flux ? `Connections: ${report.summaries.flux}` : '',
      report.summaries?.nexus ? `Experiments: ${report.summaries.nexus}` : '',
      '',
      `Generated: ${report.generatedAt}`,
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(summary);
  };

  const noveltyColors = { incremental: '#38a169', moderate: '#d69e2e', breakthrough: '#e53e3e' };

  return (
    <div className="lab-report lab-frontier-report">
      <div className="lab-report-header">
        <h3>Research Frontier Proposal</h3>
        <div className="lab-report-verdict lab-rv-likely">
          Novelty: {report.noveltyScore}%
        </div>
      </div>

      {report.summaries?.nova && (
        <p className="lab-output-summary" style={{ margin: '0 0 16px' }}>{report.summaries.nova}</p>
      )}

      <div className="lab-report-scores">
        <div className="lab-report-score-card">
          <span className="lab-report-score-value">{report.stats?.gapCount || 0}</span>
          <span className="lab-report-score-label">Gaps Found</span>
        </div>
        <div className="lab-report-score-card">
          <span className="lab-report-score-value">{report.stats?.hypothesisCount || 0}</span>
          <span className="lab-report-score-label">Hypotheses</span>
        </div>
        <div className="lab-report-score-card">
          <span className="lab-report-score-value">{report.stats?.connectionCount || 0}</span>
          <span className="lab-report-score-label">Fields Connected</span>
        </div>
        <div className="lab-report-score-card">
          <span className="lab-report-score-value">{report.stats?.experimentCount || 0}</span>
          <span className="lab-report-score-label">Experiments</span>
        </div>
      </div>

      {/* Gap Analysis */}
      <div className="lab-report-collapsible" onClick={() => toggleSection('gaps')}>
        <span>Gap Analysis ({report.gaps?.length || 0} gaps, {report.assumptions?.length || 0} assumptions)</span>
        <span>{expandedSections.gaps ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expandedSections.gaps && (
        <div className="lab-report-section">
          {report.gaps?.length > 0 && (
            <>
              <h4>Research Gaps</h4>
              <ul className="lab-claims-list">
                {report.gaps.map((g, i) => (
                  <li key={i}>
                    <span className={`lab-gap-severity lab-gap-${g.severity}`}>{g.severity}</span>
                    {g.gap}
                  </li>
                ))}
              </ul>
            </>
          )}
          {report.openQuestions?.length > 0 && (
            <>
              <h4>Open Questions</h4>
              <ul>{report.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </>
          )}
        </div>
      )}

      {/* Hypotheses */}
      <div className="lab-report-collapsible" onClick={() => toggleSection('hypotheses')}>
        <span>Novel Hypotheses ({report.hypotheses?.length || 0})</span>
        <span>{expandedSections.hypotheses ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expandedSections.hypotheses && report.hypotheses?.length > 0 && (
        <div className="lab-report-section">
          {report.hypotheses.map((h, i) => (
            <div key={i} className="lab-hypothesis-card">
              <div className="lab-hypothesis-header">
                <strong>{h.title || `Hypothesis ${h.id || i + 1}`}</strong>
                <span className="lab-novelty-badge" style={{ color: noveltyColors[h.noveltyLevel] || '#666', background: (noveltyColors[h.noveltyLevel] || '#666') + '18' }}>
                  {h.noveltyLevel}
                </span>
              </div>
              <p className="lab-hypothesis-text">{h.hypothesis}</p>
              {h.rationale && <p className="lab-hypothesis-rationale">{h.rationale}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Cross-Field */}
      <div className="lab-report-collapsible" onClick={() => toggleSection('connections')}>
        <span>Cross-Field Opportunities ({report.crossFieldConnections?.length || 0} connections)</span>
        <span>{expandedSections.connections ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expandedSections.connections && (
        <div className="lab-report-section">
          {report.crossFieldConnections?.length > 0 && report.crossFieldConnections.map((c, i) => (
            <div key={i} className="lab-field-connection">
              <div className="lab-field-bridge">
                <span className="lab-field-tag">{c.sourceField}</span>
                <span className="lab-field-arrow">&harr;</span>
                <span className="lab-field-tag">{c.targetField}</span>
              </div>
              <p className="lab-field-desc">{c.connection}</p>
            </div>
          ))}
          {report.unexpectedApplications?.length > 0 && (
            <>
              <h4>Unexpected Applications</h4>
              <ul>{report.unexpectedApplications.map((a, i) => <li key={i}><strong>{a.domain}:</strong> {a.application}</li>)}</ul>
            </>
          )}
        </div>
      )}

      {/* Experiments */}
      <div className="lab-report-collapsible" onClick={() => toggleSection('experiments')}>
        <span>Experiment Designs ({report.experiments?.length || 0})</span>
        <span>{expandedSections.experiments ? '\u25B2' : '\u25BC'}</span>
      </div>
      {expandedSections.experiments && (
        <div className="lab-report-section">
          {report.experiments?.length > 0 && report.experiments.map((e, i) => (
            <div key={i} className="lab-experiment-card">
              <div className="lab-experiment-header">
                <strong>{e.title || `Experiment ${e.id || i + 1}`}</strong>
                {e.timeline && <span className="lab-plan-hours">{e.timeline}</span>}
              </div>
              <p className="lab-field-desc">{e.methodology}</p>
            </div>
          ))}
          {report.quickWins?.length > 0 && (
            <>
              <h4>Quick Wins</h4>
              <ul className="lab-pros">{report.quickWins.map((q, i) => <li key={i}>{q}</li>)}</ul>
            </>
          )}
          {report.moonshots?.length > 0 && (
            <>
              <h4>Moonshots</h4>
              <ul className="lab-cons">{report.moonshots.map((m, i) => <li key={i}>{m}</li>)}</ul>
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

export default FrontierReport;
