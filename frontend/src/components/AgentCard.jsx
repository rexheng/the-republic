import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

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
    pending: { label: 'Waiting', badgeVariant: 'info' },
    working: { label: 'Analyzing...', badgeVariant: 'default' },
    complete: { label: 'Done', badgeVariant: 'success' },
    error: { label: 'Error', badgeVariant: 'destructive' },
  };

  const s = statusConfig[status] || statusConfig.pending;

  const firstLetter = agent.name?.charAt(0) || '?';

  return (
    <div className={`border border-neutral-200 bg-white p-0 transition-all ${status === 'working' ? 'border-neutral-400' : ''}`}>
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => (status === 'complete' || status === 'error') && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex h-9 w-9 items-center justify-center border text-sm font-mono font-bold ${
              status === 'working'
                ? 'border-neutral-900 bg-neutral-900 text-white agent-pulse'
                : status === 'complete'
                ? 'border-green-700 bg-green-50 text-green-700'
                : status === 'error'
                ? 'border-red-700 bg-red-50 text-red-700'
                : 'border-neutral-300 bg-neutral-100 text-neutral-500'
            }`}
          >
            {firstLetter}
          </span>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-neutral-900">{agent.name}</span>
            <span className="text-xs text-neutral-400">{agent.specialty}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {displayTime && <span className="text-xs font-mono text-neutral-400">{displayTime}s</span>}
          <Badge variant={s.badgeVariant}>{s.label}</Badge>
          {(status === 'complete' || status === 'error') && (
            <span className="text-xs text-neutral-400">
              {expanded ? '\u25B2' : '\u25BC'}
            </span>
          )}
        </div>
      </div>

      {expanded && status === 'error' && (
        <div className="border-t border-neutral-200 bg-red-50 px-4 py-3">
          <p className="text-sm text-red-700">{error || 'An unknown error occurred.'}</p>
        </div>
      )}

      {expanded && status === 'complete' && output && (
        <div className="border-t border-neutral-200 px-4 py-3">
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

function SectionHeading({ children }) {
  return <h4 className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2 mt-4 first:mt-0">{children}</h4>;
}

function IrisOutput({ data }) {
  return (
    <div className="space-y-3">
      {data.summary && <p className="text-sm text-neutral-600 leading-relaxed">{data.summary}</p>}
      {data.claims?.length > 0 && (
        <div>
          <SectionHeading>Claims</SectionHeading>
          <ul className="space-y-2">
            {data.claims.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge variant={c.type === 'primary' ? 'default' : 'secondary'} className="mt-0.5 shrink-0">
                  {c.type}
                </Badge>
                <span className="text-neutral-700">{c.claim}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.methodology && (
        <div>
          <SectionHeading>Methodology</SectionHeading>
          <table className="w-full text-sm">
            <tbody>
              {data.methodology.approach && <tr className="border-b border-neutral-100"><td className="py-1.5 pr-3 font-medium text-neutral-500 w-24">Approach</td><td className="py-1.5 text-neutral-700">{data.methodology.approach}</td></tr>}
              {data.methodology.dataset && <tr className="border-b border-neutral-100"><td className="py-1.5 pr-3 font-medium text-neutral-500 w-24">Dataset</td><td className="py-1.5 text-neutral-700">{data.methodology.dataset}</td></tr>}
              {data.methodology.metrics?.length > 0 && <tr className="border-b border-neutral-100"><td className="py-1.5 pr-3 font-medium text-neutral-500 w-24">Metrics</td><td className="py-1.5 text-neutral-700">{data.methodology.metrics.join(', ')}</td></tr>}
              {data.methodology.baseline && <tr><td className="py-1.5 pr-3 font-medium text-neutral-500 w-24">Baseline</td><td className="py-1.5 text-neutral-700">{data.methodology.baseline}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {data.replicationDifficulty && (
        <Badge variant={
          data.replicationDifficulty === 'low' ? 'success'
          : data.replicationDifficulty === 'high' ? 'destructive'
          : 'warning'
        }>
          {data.replicationDifficulty} difficulty
        </Badge>
      )}
    </div>
  );
}

function AtlasOutput({ data }) {
  return (
    <div className="space-y-3">
      {data.plan?.length > 0 && (
        <div>
          <SectionHeading>Replication Plan</SectionHeading>
          <ol className="space-y-2 list-decimal list-inside">
            {data.plan.map((s, i) => (
              <li key={i} className="text-sm text-neutral-700">
                <strong className="text-neutral-900">{s.title}</strong>
                <span className="block ml-5 text-neutral-500">{s.description}</span>
                {s.estimatedHours && <span className="ml-5 inline-block mt-0.5 text-xs font-mono text-neutral-400">{s.estimatedHours}h</span>}
              </li>
            ))}
          </ol>
        </div>
      )}
      {data.pythonCode && (
        <div>
          <SectionHeading>Python Code</SectionHeading>
          <pre className="bg-neutral-50 border border-neutral-200 p-3 text-xs font-mono overflow-x-auto"><code>{data.pythonCode}</code></pre>
        </div>
      )}
      {data.feasibilityScore != null && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-neutral-500">Feasibility</span>
          <div className="flex-1 h-2 bg-neutral-100 border border-neutral-200">
            <div className="h-full bg-neutral-900 transition-all" style={{ width: `${data.feasibilityScore}%` }} />
          </div>
          <span className="text-sm font-mono text-neutral-600">{data.feasibilityScore}%</span>
        </div>
      )}
      {data.risks?.length > 0 && (
        <div>
          <SectionHeading>Risks</SectionHeading>
          <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">{data.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function TensorOutput({ data }) {
  return (
    <div className="space-y-3">
      {data.simulatedResults?.length > 0 && (
        <div>
          <SectionHeading>Simulated Results</SectionHeading>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="py-1.5 text-left font-medium text-neutral-500">Metric</th>
                <th className="py-1.5 text-left font-medium text-neutral-500">Original</th>
                <th className="py-1.5 text-left font-medium text-neutral-500">Estimated</th>
                <th className="py-1.5 text-left font-medium text-neutral-500">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {data.simulatedResults.map((r, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-1.5 text-neutral-700">{r.metric}</td>
                  <td className="py-1.5 text-neutral-700">{r.original}</td>
                  <td className="py-1.5 text-neutral-700">{r.estimated}</td>
                  <td className="py-1.5">
                    <Badge variant={
                      r.confidence === 'high' ? 'success'
                      : r.confidence === 'low' ? 'destructive'
                      : 'warning'
                    }>
                      {r.confidence}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.matchPrediction != null && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-neutral-500">Match Prediction</span>
          <div className="flex-1 h-2 bg-neutral-100 border border-neutral-200">
            <div className="h-full bg-neutral-900 transition-all" style={{ width: `${data.matchPrediction}%` }} />
          </div>
          <span className="text-sm font-mono text-neutral-600">{data.matchPrediction}%</span>
        </div>
      )}
      {data.computationalCost && (
        <div>
          <SectionHeading>Computational Cost</SectionHeading>
          <table className="w-full text-sm">
            <tbody>
              {data.computationalCost.gpuHours && <tr className="border-b border-neutral-100"><td className="py-1.5 pr-3 font-medium text-neutral-500 w-32">GPU Hours</td><td className="py-1.5 text-neutral-700">{data.computationalCost.gpuHours}</td></tr>}
              {data.computationalCost.estimatedCost && <tr className="border-b border-neutral-100"><td className="py-1.5 pr-3 font-medium text-neutral-500 w-32">Estimated Cost</td><td className="py-1.5 text-neutral-700">{data.computationalCost.estimatedCost}</td></tr>}
              {data.computationalCost.hardware && <tr><td className="py-1.5 pr-3 font-medium text-neutral-500 w-32">Hardware</td><td className="py-1.5 text-neutral-700">{data.computationalCost.hardware}</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SageOutput({ data }) {
  return (
    <div className="space-y-3">
      {data.verdict && (
        <Badge variant={
          data.verdict?.toLowerCase().includes('reject') ? 'destructive'
          : data.verdict?.toLowerCase().includes('accept') ? 'success'
          : 'warning'
        } className="text-sm px-3 py-1">
          {data.verdict}
        </Badge>
      )}
      {data.overallScore != null && (
        <div className="text-sm text-neutral-600">Overall: <strong className="text-neutral-900">{data.overallScore}/10</strong></div>
      )}
      {data.scores && (
        <div>
          <SectionHeading>Review Scores</SectionHeading>
          <div className="space-y-2">
            {Object.entries(data.scores).map(([key, val]) => (
              <div key={key} className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-neutral-100 border border-neutral-200">
                  <div className="h-full bg-neutral-900 transition-all" style={{ width: `${(val.score / 10) * 100}%` }} />
                </div>
                <span className="text-xs text-neutral-500 w-28 truncate">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                <span className="text-xs font-mono text-neutral-700 w-10 text-right">{val.score}/10</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.strengths?.length > 0 && (
        <div>
          <SectionHeading>Strengths</SectionHeading>
          <ul className="list-disc list-inside space-y-1 text-sm text-green-700">{data.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
      {data.weaknesses?.length > 0 && (
        <div>
          <SectionHeading>Weaknesses</SectionHeading>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-700">{data.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </div>
      )}
      {data.replicationVerdict && (
        <Badge variant={
          data.replicationVerdict?.toLowerCase().includes('unlikely') ? 'destructive'
          : data.replicationVerdict?.toLowerCase().includes('partial') ? 'warning'
          : 'success'
        }>
          {data.replicationVerdict}
        </Badge>
      )}
    </div>
  );
}

function ScribeOutput({ data }) {
  return (
    <div>
      <p className="text-sm text-neutral-500">Report compiled. See the full report below.</p>
    </div>
  );
}

function NovaOutput({ data }) {
  return (
    <div className="space-y-3">
      {data.summary && <p className="text-sm text-neutral-600 leading-relaxed">{data.summary}</p>}
      {data.gaps?.length > 0 && (
        <div>
          <SectionHeading>Research Gaps</SectionHeading>
          <ul className="space-y-2">
            {data.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge variant={
                  g.severity === 'critical' ? 'destructive'
                  : g.severity === 'moderate' ? 'warning'
                  : 'info'
                } className="mt-0.5 shrink-0">
                  {g.severity}
                </Badge>
                <span className="text-neutral-700">{g.gap}</span>
                {g.field && <Badge variant="outline" className="ml-auto shrink-0">{g.field}</Badge>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.assumptions?.length > 0 && (
        <div>
          <SectionHeading>Challenged Assumptions</SectionHeading>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="py-1.5 text-left font-medium text-neutral-500">Assumption</th>
                <th className="py-1.5 text-left font-medium text-neutral-500">Weakness</th>
              </tr>
            </thead>
            <tbody>
              {data.assumptions.map((a, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-1.5 text-neutral-700">{a.assumption}</td>
                  <td className="py-1.5 text-neutral-700">{a.weakness}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.openQuestions?.length > 0 && (
        <div>
          <SectionHeading>Open Questions</SectionHeading>
          <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">{data.openQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </div>
      )}
      {data.emergingDirections?.length > 0 && (
        <div>
          <SectionHeading>Emerging Directions</SectionHeading>
          <ul className="space-y-2">
            {data.emergingDirections.map((d, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Badge variant={d.potential === 'high' ? 'default' : 'secondary'} className="mt-0.5 shrink-0">
                  {d.potential}
                </Badge>
                <span className="text-neutral-700">{d.direction}</span>
                {d.timeframe && <span className="ml-auto text-xs font-mono text-neutral-400 shrink-0">{d.timeframe}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function EurekaOutput({ data }) {
  return (
    <div className="space-y-3">
      {data.summary && <p className="text-sm text-neutral-600 leading-relaxed">{data.summary}</p>}
      {data.hypotheses?.length > 0 && (
        <div>
          <SectionHeading>Novel Hypotheses</SectionHeading>
          {data.hypotheses.map((h, i) => (
            <div key={i} className="border border-neutral-200 p-3 mb-2">
              <div className="flex items-center justify-between mb-1">
                <strong className="text-sm text-neutral-900">{h.title || `Hypothesis ${h.id || i + 1}`}</strong>
                <Badge variant={
                  h.noveltyLevel === 'breakthrough' ? 'destructive'
                  : h.noveltyLevel === 'moderate' ? 'warning'
                  : 'success'
                }>
                  {h.noveltyLevel}
                </Badge>
              </div>
              <p className="text-sm text-neutral-700 mb-1">{h.hypothesis}</p>
              {h.rationale && <p className="text-xs text-neutral-400 italic">{h.rationale}</p>}
              {h.testability && (
                <Badge variant={
                  h.testability === 'easy' ? 'success'
                  : h.testability === 'challenging' ? 'destructive'
                  : 'warning'
                } className="mt-2">
                  {h.testability} to test
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}
      {data.researchQuestions?.length > 0 && (
        <div>
          <SectionHeading>Research Questions</SectionHeading>
          <ul className="list-disc list-inside space-y-1 text-sm text-neutral-700">{data.researchQuestions.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function FluxOutput({ data }) {
  return (
    <div className="space-y-3">
      {data.summary && <p className="text-sm text-neutral-600 leading-relaxed">{data.summary}</p>}
      {data.crossFieldConnections?.length > 0 && (
        <div>
          <SectionHeading>Cross-Field Connections</SectionHeading>
          {data.crossFieldConnections.map((c, i) => (
            <div key={i} className="border border-neutral-200 p-3 mb-2">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline">{c.sourceField}</Badge>
                <span className="text-neutral-400">&harr;</span>
                <Badge variant="outline">{c.targetField}</Badge>
                <Badge variant={c.potential === 'high' ? 'default' : 'secondary'} className="ml-auto">
                  {c.potential}
                </Badge>
              </div>
              <p className="text-sm text-neutral-600">{c.connection}</p>
            </div>
          ))}
        </div>
      )}
      {data.unexpectedApplications?.length > 0 && (
        <div>
          <SectionHeading>Unexpected Applications</SectionHeading>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="py-1.5 text-left font-medium text-neutral-500">Application</th>
                <th className="py-1.5 text-left font-medium text-neutral-500">Domain</th>
                <th className="py-1.5 text-left font-medium text-neutral-500">Feasibility</th>
              </tr>
            </thead>
            <tbody>
              {data.unexpectedApplications.map((a, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-1.5 text-neutral-700">{a.application}</td>
                  <td className="py-1.5 text-neutral-700">{a.domain}</td>
                  <td className="py-1.5">
                    <Badge variant={
                      a.feasibility === 'high' ? 'success'
                      : a.feasibility === 'low' ? 'destructive'
                      : 'warning'
                    }>
                      {a.feasibility}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data.methodTransfers?.length > 0 && (
        <div>
          <SectionHeading>Method Transfers</SectionHeading>
          {data.methodTransfers.map((m, i) => (
            <div key={i} className="border border-neutral-200 p-3 mb-2">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline">{m.originField}</Badge>
                <span className="text-neutral-400">&rarr;</span>
                <Badge variant="outline">{m.targetField}</Badge>
              </div>
              <p className="text-sm text-neutral-600"><strong className="text-neutral-900">{m.method}:</strong> {m.adaptation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NexusOutput({ data }) {
  return (
    <div className="space-y-3">
      {data.summary && <p className="text-sm text-neutral-600 leading-relaxed">{data.summary}</p>}
      {data.experiments?.length > 0 && (
        <div>
          <SectionHeading>Experiment Designs</SectionHeading>
          {data.experiments.map((e, i) => (
            <div key={i} className="border border-neutral-200 p-3 mb-2">
              <div className="flex items-center justify-between mb-1">
                <strong className="text-sm text-neutral-900">{e.title || `Experiment ${e.id || i + 1}`}</strong>
                {e.timeline && <span className="text-xs font-mono text-neutral-400">{e.timeline}</span>}
              </div>
              <p className="text-sm text-neutral-600 mb-2">{e.methodology}</p>
              {e.datasets?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-medium text-neutral-500">Data:</span>
                  {e.datasets.map((d, j) => <Badge key={j} variant="outline">{d}</Badge>)}
                </div>
              )}
              {e.metrics?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-medium text-neutral-500">Metrics:</span>
                  {e.metrics.map((m, j) => <Badge key={j} variant="outline">{m}</Badge>)}
                </div>
              )}
              {e.expertise?.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-medium text-neutral-500">Expertise:</span>
                  {e.expertise.map((x, j) => <Badge key={j} variant="outline">{x}</Badge>)}
                </div>
              )}
              {e.expectedOutcome && <p className="text-xs text-neutral-400 italic mt-1">Expected: {e.expectedOutcome}</p>}
            </div>
          ))}
        </div>
      )}
      {data.quickWins?.length > 0 && (
        <div>
          <SectionHeading>Quick Wins</SectionHeading>
          <ul className="list-disc list-inside space-y-1 text-sm text-green-700">{data.quickWins.map((q, i) => <li key={i}>{q}</li>)}</ul>
        </div>
      )}
      {data.moonshots?.length > 0 && (
        <div>
          <SectionHeading>Moonshots</SectionHeading>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-700">{data.moonshots.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

function FormalOutput({ data }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (data.leanCode) {
      navigator.clipboard.writeText(data.leanCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-3">
      {data.formalizationNotes && <p className="text-sm text-neutral-600 leading-relaxed">{data.formalizationNotes}</p>}
      {data.completeness && (
        <Badge variant={
          data.completeness === 'full' ? 'success'
          : data.completeness === 'partial' ? 'warning'
          : 'info'
        }>
          {data.completeness} formalization
        </Badge>
      )}
      {data.theorems?.length > 0 && (
        <div>
          <SectionHeading>Theorems</SectionHeading>
          {data.theorems.map((t, i) => (
            <div key={i} className="border border-neutral-200 p-3 mb-2">
              <div className="flex items-center justify-between mb-1">
                <code className="text-sm font-mono text-neutral-900">{t.name}</code>
                <Badge variant={
                  t.difficulty === 'easy' ? 'success'
                  : t.difficulty === 'hard' ? 'destructive'
                  : t.difficulty === 'open_problem' ? 'default'
                  : 'warning'
                }>
                  {t.difficulty?.replace('_', ' ')}
                </Badge>
              </div>
              {t.claim && <p className="text-sm text-neutral-600">{t.claim}</p>}
              {t.proofStrategy && <p className="text-xs text-neutral-400 italic mt-1">Strategy: {t.proofStrategy}</p>}
            </div>
          ))}
        </div>
      )}
      {data.leanCode && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <SectionHeading>Lean 4 Code</SectionHeading>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <pre className="bg-neutral-50 border border-neutral-200 p-3 text-xs font-mono overflow-x-auto"><code>{data.leanCode}</code></pre>
        </div>
      )}
      {data.mathlibDeps?.length > 0 && (
        <div>
          <SectionHeading>Mathlib Dependencies</SectionHeading>
          <div className="flex flex-wrap gap-1">
            {data.mathlibDeps.map((d, i) => <Badge key={i} variant="outline">{d}</Badge>)}
          </div>
        </div>
      )}
    </div>
  );
}

function RawOutput({ data }) {
  // Format the raw text nicely instead of showing an error
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  // Split into paragraphs and render with basic formatting
  const paragraphs = text.split(/\n\n+/).filter(Boolean);
  return (
    <div className="space-y-3">
      {paragraphs.map((para, i) => {
        const trimmed = para.trim();
        // Detect headings (lines starting with # or ALL CAPS short lines)
        if (trimmed.startsWith('#')) {
          return <h4 key={i} className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-500 mt-3">{trimmed.replace(/^#+\s*/, '')}</h4>;
        }
        // Detect bullet points
        if (trimmed.includes('\n-') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const lines = trimmed.split('\n');
          return (
            <ul key={i} className="space-y-1 ml-2">
              {lines.map((line, j) => (
                <li key={j} className="text-sm text-neutral-700 leading-relaxed flex gap-2">
                  {(line.startsWith('-') || line.startsWith('*')) && <span className="text-neutral-400 flex-shrink-0">-</span>}
                  <span>{line.replace(/^[-*]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          );
        }
        return <p key={i} className="text-sm text-neutral-700 leading-relaxed">{trimmed}</p>;
      })}
    </div>
  );
}

export default AgentCard;
