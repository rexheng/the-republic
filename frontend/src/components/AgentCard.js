import React, { useState, useEffect } from 'react';

function AgentCard({ agent, status, output, duration, error }) {
  const [expanded, setExpanded] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Live timer while working
  useEffect(() => {
    if (status !== 'working') return;
    const start = Date.now();
    const interval = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(interval);
  }, [status]);

  // Auto-expand on completion
  useEffect(() => {
    if (status === 'complete') setExpanded(true);
  }, [status]);

  const displayTime = status === 'working'
    ? (elapsed / 1000).toFixed(1)
    : duration ? (duration / 1000).toFixed(1) : null;

  const statusConfig = {
    pending: { label: 'Waiting', className: 'lab-status-pending' },
    working: { label: 'Analyzing...', className: 'lab-status-working' },
    complete: { label: 'Done', className: 'lab-status-complete' },
    error: { label: 'Error', className: 'lab-status-error' },
  };

  const s = statusConfig[status] || statusConfig.pending;

  return (
    <div className={`lab-agent-card ${status === 'working' ? 'lab-agent-active' : ''}`}>
      <div className="lab-agent-header" onClick={() => (status === 'complete' || status === 'error') && setExpanded(!expanded)}>
        <div className="lab-agent-identity">
          <span
            className={`lab-agent-avatar ${status === 'working' ? 'lab-avatar-pulse' : ''}`}
            style={{ background: agent.color + '22', borderColor: agent.color }}
          >
            {agent.emoji}
          </span>
          <div>
            <span className="lab-agent-name">{agent.name}</span>
            <span className="lab-agent-specialty">{agent.specialty}</span>
          </div>
        </div>
        <div className="lab-agent-right">
          {displayTime && <span className="lab-agent-time">{displayTime}s</span>}
          <span className={`lab-agent-status ${s.className}`}>{s.label}</span>
          {(status === 'complete' || status === 'error') && (
            <span className={`lab-agent-expand ${expanded ? 'expanded' : ''}`}>
              {expanded ? '\u25B2' : '\u25BC'}
            </span>
          )}
        </div>
      </div>

      {expanded && status === 'error' && (
        <div className="lab-agent-body lab-agent-error-body">
          <p>{error || 'An unknown error occurred.'}</p>
        </div>
      )}

      {expanded && status === 'complete' && output && (
        <div className="lab-agent-body">
          {agent.id === 'iris' && <IrisOutput data={output} />}
          {agent.id === 'atlas' && <AtlasOutput data={output} />}
          {agent.id === 'tensor' && <TensorOutput data={output} />}
          {agent.id === 'sage' && <SageOutput data={output} />}
          {(agent.id === 'scribe' || agent.id === 'frontier-scribe') && <ScribeOutput data={output} />}
          {agent.id === 'nova' && <NovaOutput data={output} />}
          {agent.id === 'eureka' && <EurekaOutput data={output} />}
          {agent.id === 'flux' && <FluxOutput data={output} />}
          {agent.id === 'nexus' && <NexusOutput data={output} />}
          {(agent.id === 'formal' || agent.id === 'frontier-formal') && <FormalOutput data={output} />}
          {output._parseError && <RawOutput data={output._raw} />}
        </div>
      )}
    </div>
  );
}

function IrisOutput({ data }) {
  return (
    <div className="lab-output">
      {data.summary && <p className="lab-output-summary">{data.summary}</p>}
      {data.claims?.length > 0 && (
        <div className="lab-output-section">
          <h4>Claims</h4>
          <ul className="lab-claims-list">
            {data.claims.map((c, i) => (
              <li key={i}>
                <span className={`lab-claim-type lab-claim-${c.type}`}>{c.type}</span>
                {c.claim}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.methodology && (
        <div className="lab-output-section">
          <h4>Methodology</h4>
          <table className="lab-table">
            <tbody>
              {data.methodology.approach && <tr><td>Approach</td><td>{data.methodology.approach}</td></tr>}
              {data.methodology.dataset && <tr><td>Dataset</td><td>{data.methodology.dataset}</td></tr>}
              {data.methodology.metrics?.length > 0 && <tr><td>Metrics</td><td>{data.methodology.metrics.join(', ')}</td></tr>}
              {data.methodology.baseline && <tr><td>Baseline</td><td>{data.methodology.baseline}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {data.replicationDifficulty && (
        <span className={`lab-difficulty lab-difficulty-${data.replicationDifficulty}`}>
          {data.replicationDifficulty} difficulty
        </span>
      )}
    </div>
  );
}

function AtlasOutput({ data }) {
  return (
    <div className="lab-output">
      {data.plan?.length > 0 && (
        <div className="lab-output-section">
          <h4>Replication Plan</h4>
          <ol className="lab-plan-list">
            {data.plan.map((s, i) => (
              <li key={i}>
                <strong>{s.title}</strong>
                <span className="lab-plan-desc">{s.description}</span>
                {s.estimatedHours && <span className="lab-plan-hours">{s.estimatedHours}h</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {data.pythonCode && (
        <div className="lab-output-section">
          <h4>Python Code</h4>
          <pre className="lab-code-block"><code>{data.pythonCode}</code></pre>
        </div>
      )}
      {data.feasibilityScore != null && (
        <div className="lab-feasibility">
          <span>Feasibility</span>
          <div className="lab-gauge">
            <div className="lab-gauge-fill" style={{ width: `${data.feasibilityScore}%` }} />
          </div>
          <span className="lab-gauge-label">{data.feasibilityScore}%</span>
        </div>
      )}
      {data.risks?.length > 0 && (
        <div className="lab-output-section">
          <h4>Risks</h4>
          <ul>{data.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function TensorOutput({ data }) {
  return (
    <div className="lab-output">
      {data.simulatedResults?.length > 0 && (
        <div className="lab-output-section">
          <h4>Simulated Results</h4>
          <table className="lab-table lab-table-results">
            <thead>
              <tr><th>Metric</th><th>Original</th><th>Estimated</th><th>Confidence</th></tr>
            </thead>
            <tbody>
              {data.simulatedResults.map((r, i) => (
                <tr key={i}>
                  <td>{r.metric}</td>
                  <td>{r.original}</td>
                  <td>{r.estimated}</td>
                  <td><span className={`lab-confidence lab-confidence-${r.confidence}`}>{r.confidence}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.matchPrediction != null && (
        <div className="lab-feasibility">
          <span>Match Prediction</span>
          <div className="lab-gauge">
            <div className="lab-gauge-fill" style={{ width: `${data.matchPrediction}%` }} />
          </div>
          <span className="lab-gauge-label">{data.matchPrediction}%</span>
        </div>
      )}
      {data.computationalCost && (
        <div className="lab-output-section">
          <h4>Computational Cost</h4>
          <table className="lab-table">
            <tbody>
              {data.computationalCost.gpuHours && <tr><td>GPU Hours</td><td>{data.computationalCost.gpuHours}</td></tr>}
              {data.computationalCost.estimatedCost && <tr><td>Estimated Cost</td><td>{data.computationalCost.estimatedCost}</td></tr>}
              {data.computationalCost.hardware && <tr><td>Hardware</td><td>{data.computationalCost.hardware}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SageOutput({ data }) {
  return (
    <div className="lab-output">
      {data.verdict && (
        <div className={`lab-verdict-badge lab-verdict-${data.verdict?.toLowerCase().replace(/\s/g, '-')}`}>
          {data.verdict}
        </div>
      )}
      {data.overallScore != null && (
        <div className="lab-overall-score">Overall: <strong>{data.overallScore}/10</strong></div>
      )}
      {data.scores && (
        <div className="lab-output-section">
          <h4>Review Scores</h4>
          <div className="lab-scores-grid">
            {Object.entries(data.scores).map(([key, val]) => (
              <div key={key} className="lab-score-item">
                <div className="lab-score-bar">
                  <div className="lab-score-fill" style={{ width: `${(val.score / 10) * 100}%` }} />
                </div>
                <span className="lab-score-name">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="lab-score-val">{val.score}/10</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.strengths?.length > 0 && (
        <div className="lab-output-section">
          <h4>Strengths</h4>
          <ul className="lab-pros">{data.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {data.weaknesses?.length > 0 && (
        <div className="lab-output-section">
          <h4>Weaknesses</h4>
          <ul className="lab-cons">{data.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
      {data.replicationVerdict && (
        <div className={`lab-replication-verdict lab-rv-${data.replicationVerdict?.toLowerCase().includes('unlikely') ? 'unlikely' : data.replicationVerdict?.toLowerCase().includes('partial') ? 'partial' : 'likely'}`}>
          {data.replicationVerdict}
        </div>
      )}
    </div>
  );
}

function ScribeOutput({ data }) {
  return (
    <div className="lab-output">
      <p className="lab-output-summary">Report compiled. See the full report below.</p>
    </div>
  );
}

function NovaOutput({ data }) {
  return (
    <div className="lab-output">
      {data.summary && <p className="lab-output-summary">{data.summary}</p>}
      {data.gaps?.length > 0 && (
        <div className="lab-output-section">
          <h4>Research Gaps</h4>
          <ul className="lab-claims-list">
            {data.gaps.map((g, i) => (
              <li key={i}>
                <span className={`lab-gap-severity lab-gap-${g.severity}`}>{g.severity}</span>
                {g.gap}
                {g.field && <span className="lab-gap-field">{g.field}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.assumptions?.length > 0 && (
        <div className="lab-output-section">
          <h4>Challenged Assumptions</h4>
          <table className="lab-table">
            <thead><tr><th>Assumption</th><th>Weakness</th></tr></thead>
            <tbody>
              {data.assumptions.map((a, i) => (
                <tr key={i}><td>{a.assumption}</td><td>{a.weakness}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.openQuestions?.length > 0 && (
        <div className="lab-output-section">
          <h4>Open Questions</h4>
          <ul>{data.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </div>
      )}
      {data.emergingDirections?.length > 0 && (
        <div className="lab-output-section">
          <h4>Emerging Directions</h4>
          <ul className="lab-claims-list">
            {data.emergingDirections.map((d, i) => (
              <li key={i}>
                <span className={`lab-claim-type lab-claim-${d.potential === 'high' ? 'primary' : 'secondary'}`}>{d.potential}</span>
                {d.direction}
                {d.timeframe && <span className="lab-plan-hours">{d.timeframe}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EurekaOutput({ data }) {
  const noveltyColors = { incremental: '#38a169', moderate: '#d69e2e', breakthrough: '#e53e3e' };
  return (
    <div className="lab-output">
      {data.summary && <p className="lab-output-summary">{data.summary}</p>}
      {data.hypotheses?.length > 0 && (
        <div className="lab-output-section">
          <h4>Novel Hypotheses</h4>
          {data.hypotheses.map((h, i) => (
            <div key={i} className="lab-hypothesis-card">
              <div className="lab-hypothesis-header">
                <strong>{h.title || `Hypothesis ${h.id || i + 1}`}</strong>
                <span className="lab-novelty-badge" style={{ color: noveltyColors[h.noveltyLevel] || '#666', background: (noveltyColors[h.noveltyLevel] || '#666') + '18' }}>
                  {h.noveltyLevel}
                </span>
              </div>
              <p className="lab-hypothesis-text">{h.hypothesis}</p>
              {h.rationale && <p className="lab-hypothesis-rationale">{h.rationale}</p>}
              {h.testability && (
                <span className={`lab-difficulty lab-difficulty-${h.testability === 'easy' ? 'low' : h.testability === 'challenging' ? 'high' : 'medium'}`}>
                  {h.testability} to test
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      {data.researchQuestions?.length > 0 && (
        <div className="lab-output-section">
          <h4>Research Questions</h4>
          <ul>{data.researchQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function FluxOutput({ data }) {
  return (
    <div className="lab-output">
      {data.summary && <p className="lab-output-summary">{data.summary}</p>}
      {data.crossFieldConnections?.length > 0 && (
        <div className="lab-output-section">
          <h4>Cross-Field Connections</h4>
          {data.crossFieldConnections.map((c, i) => (
            <div key={i} className="lab-field-connection">
              <div className="lab-field-bridge">
                <span className="lab-field-tag">{c.sourceField}</span>
                <span className="lab-field-arrow">&harr;</span>
                <span className="lab-field-tag">{c.targetField}</span>
                <span className={`lab-claim-type lab-claim-${c.potential === 'high' ? 'primary' : 'secondary'}`}>{c.potential}</span>
              </div>
              <p className="lab-field-desc">{c.connection}</p>
            </div>
          ))}
        </div>
      )}
      {data.unexpectedApplications?.length > 0 && (
        <div className="lab-output-section">
          <h4>Unexpected Applications</h4>
          <table className="lab-table">
            <thead><tr><th>Application</th><th>Domain</th><th>Feasibility</th></tr></thead>
            <tbody>
              {data.unexpectedApplications.map((a, i) => (
                <tr key={i}>
                  <td>{a.application}</td>
                  <td>{a.domain}</td>
                  <td><span className={`lab-confidence lab-confidence-${a.feasibility}`}>{a.feasibility}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.methodTransfers?.length > 0 && (
        <div className="lab-output-section">
          <h4>Method Transfers</h4>
          {data.methodTransfers.map((m, i) => (
            <div key={i} className="lab-field-connection">
              <div className="lab-field-bridge">
                <span className="lab-field-tag">{m.originField}</span>
                <span className="lab-field-arrow">&rarr;</span>
                <span className="lab-field-tag">{m.targetField}</span>
              </div>
              <p className="lab-field-desc"><strong>{m.method}:</strong> {m.adaptation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NexusOutput({ data }) {
  return (
    <div className="lab-output">
      {data.summary && <p className="lab-output-summary">{data.summary}</p>}
      {data.experiments?.length > 0 && (
        <div className="lab-output-section">
          <h4>Experiment Designs</h4>
          {data.experiments.map((e, i) => (
            <div key={i} className="lab-experiment-card">
              <div className="lab-experiment-header">
                <strong>{e.title || `Experiment ${e.id || i + 1}`}</strong>
                {e.timeline && <span className="lab-plan-hours">{e.timeline}</span>}
              </div>
              <p className="lab-field-desc">{e.methodology}</p>
              {e.datasets?.length > 0 && (
                <div className="lab-experiment-tags">
                  <span className="lab-tag-label">Data:</span>
                  {e.datasets.map((d, j) => <span key={j} className="lab-field-tag">{d}</span>)}
                </div>
              )}
              {e.metrics?.length > 0 && (
                <div className="lab-experiment-tags">
                  <span className="lab-tag-label">Metrics:</span>
                  {e.metrics.map((m, j) => <span key={j} className="lab-field-tag">{m}</span>)}
                </div>
              )}
              {e.expertise?.length > 0 && (
                <div className="lab-experiment-tags">
                  <span className="lab-tag-label">Expertise:</span>
                  {e.expertise.map((x, j) => <span key={j} className="lab-field-tag">{x}</span>)}
                </div>
              )}
              {e.expectedOutcome && <p className="lab-hypothesis-rationale">Expected: {e.expectedOutcome}</p>}
            </div>
          ))}
        </div>
      )}
      {data.quickWins?.length > 0 && (
        <div className="lab-output-section">
          <h4>Quick Wins</h4>
          <ul className="lab-pros">{data.quickWins.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </div>
      )}
      {data.moonshots?.length > 0 && (
        <div className="lab-output-section">
          <h4>Moonshots</h4>
          <ul className="lab-cons">{data.moonshots.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function FormalOutput({ data }) {
  const difficultyColors = { easy: '#38a169', moderate: '#d69e2e', hard: '#e53e3e', open_problem: '#805AD5' };
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (data.leanCode) {
      navigator.clipboard.writeText(data.leanCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="lab-output">
      {data.formalizationNotes && <p className="lab-output-summary">{data.formalizationNotes}</p>}
      {data.completeness && (
        <span className={`lab-formal-completeness lab-formal-${data.completeness}`}>
          {data.completeness} formalization
        </span>
      )}
      {data.theorems?.length > 0 && (
        <div className="lab-output-section">
          <h4>Theorems</h4>
          {data.theorems.map((t, i) => (
            <div key={i} className="lab-formal-theorem">
              <div className="lab-formal-theorem-header">
                <code className="lab-formal-name">{t.name}</code>
                <span className="lab-formal-difficulty" style={{
                  color: difficultyColors[t.difficulty] || '#666',
                  background: (difficultyColors[t.difficulty] || '#666') + '18'
                }}>
                  {t.difficulty?.replace('_', ' ')}
                </span>
              </div>
              {t.claim && <p className="lab-formal-claim">{t.claim}</p>}
              {t.proofStrategy && <p className="lab-hypothesis-rationale">Strategy: {t.proofStrategy}</p>}
            </div>
          ))}
        </div>
      )}
      {data.leanCode && (
        <div className="lab-output-section">
          <div className="lab-formal-code-header">
            <h4>Lean 4 Code</h4>
            <button className="lab-formal-copy-btn" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <pre className="lab-code-block lab-lean-code"><code>{data.leanCode}</code></pre>
        </div>
      )}
      {data.mathlibDeps?.length > 0 && (
        <div className="lab-output-section">
          <h4>Mathlib Dependencies</h4>
          <div className="lab-formal-deps">
            {data.mathlibDeps.map((d, i) => <span key={i} className="lab-field-tag">{d}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}

function RawOutput({ data }) {
  return (
    <div className="lab-output">
      <p className="lab-output-warn">Could not parse structured output. Raw response:</p>
      <pre className="lab-code-block"><code>{data}</code></pre>
    </div>
  );
}

export default AgentCard;
