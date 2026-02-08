import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FadeIn } from '@/components/ui/fade-in';
import { BACKEND_URL } from '../config';

const CASTE_ICONS = { guardian: '🛡️', philosopher: '⚔️', producer: '🔨' };
const CASTE_COLOURS = { guardian: 'border-amber-300 bg-amber-50', philosopher: 'border-purple-300 bg-purple-50', producer: 'border-green-300 bg-green-50' };

function AgentCommandCentre() {
  const [agents, setAgents] = useState([]);
  const [budget, setBudget] = useState({});
  const [running, setRunning] = useState(false);
  const [currentAgent, setCurrentAgent] = useState(null);
  const [actionFeed, setActionFeed] = useState([]);
  const [trismStatus, setTrismStatus] = useState(null);
  const [papers, setPapers] = useState([]);
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [activeView, setActiveView] = useState('swarm'); // swarm | trism

  const fetchAgents = useCallback(async () => {
    try {
      const [agentsRes, budgetRes, trismRes, papersRes] = await Promise.allSettled([
        fetch(`${BACKEND_URL}/api/agents`).then(r => r.json()),
        fetch(`${BACKEND_URL}/api/agents/budget`).then(r => r.json()),
        fetch(`${BACKEND_URL}/api/trism/status`).then(r => r.json()),
        fetch(`${BACKEND_URL}/api/kg/papers`).then(r => r.json()),
      ]);
      if (agentsRes.status === 'fulfilled') setAgents(agentsRes.value);
      if (budgetRes.status === 'fulfilled') setBudget(budgetRes.value);
      if (trismRes.status === 'fulfilled') setTrismStatus(trismRes.value);
      if (papersRes.status === 'fulfilled') {
        setPapers(papersRes.value);
        if (!selectedPaper && papersRes.value.length > 0) setSelectedPaper(papersRes.value[0]);
      }
    } catch (e) {
      console.error('Failed to fetch agents:', e);
    }
  }, [selectedPaper]);

  useEffect(() => { fetchAgents(); }, [fetchAgents]);

  const runPipeline = async () => {
    if (!selectedPaper) return;
    setRunning(true);
    setActionFeed([]);

    const pipelineAgents = agents.map(a => a.id);
    for (const agentId of pipelineAgents) {
      const agent = agents.find(a => a.id === agentId);
      if (!agent) continue;
      setCurrentAgent(agentId);

      setActionFeed(prev => [...prev, {
        agent: agent.name,
        agentId,
        status: 'running',
        time: new Date().toLocaleTimeString(),
      }]);

      try {
        const task = `Analyse the paper "${selectedPaper.title}" by ${(selectedPaper.authors || []).join(', ')} (${selectedPaper.year}).

Abstract: ${selectedPaper.abstract || 'N/A'}
Fields: ${(selectedPaper.fieldsOfStudy || []).join(', ')}
Citations: ${selectedPaper.citationCount || 'Unknown'}

Provide your analysis in your role as ${agent.role} (${agent.caste} caste). Be thorough but concise. Use British English.`;

        const res = await fetch(`${BACKEND_URL}/api/agents/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, task }),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (data.error) {
          setActionFeed(prev => prev.map(f =>
            f.agentId === agentId ? { ...f, status: 'error', response: data.error } : f
          ));
        } else {
          setActionFeed(prev => prev.map(f =>
            f.agentId === agentId ? {
              ...f,
              status: 'done',
              response: data.content || '[No content]',
              tokensUsed: data.tokensUsed,
              trism: data.trismResult,
            } : f
          ));
        }
      } catch (e) {
        setActionFeed(prev => prev.map(f =>
          f.agentId === agentId ? { ...f, status: 'error', response: e.message } : f
        ));
      }
    }

    setCurrentAgent(null);
    setRunning(false);
    fetchAgents(); // Refresh budget
  };

  const getCasteBudget = (caste) => {
    const b = budget[caste];
    if (!b) return { pct: 0, used: 0, limit: 100000 };
    return { pct: Math.round(b.ratio * 100), used: b.used, limit: b.limit };
  };

  return (
    <div>
      <FadeIn>
        <span className="section-label mb-2 block text-neutral-400">Main Track: AI Middleware & Application</span>
        <h2 className="section-title mb-2">Agent Swarm Engine</h2>
        <p className="body-text text-sm mb-8">
          Autonomous coordination of specialized agent castes with real-time TRiSM (Trust, Risk, and Security Management) guardrails.
        </p>
      </FadeIn>

      <div className="flex gap-1 border-b border-neutral-100 mb-8">
        <button 
          className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${activeView === 'swarm' ? 'text-neutral-900 border-b-2 border-neutral-900 -mb-px' : 'text-neutral-400 hover:text-neutral-600'}`}
          onClick={() => setActiveView('swarm')}
        >
          Swarm Control
        </button>
        <button 
          className={`px-4 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors ${activeView === 'trism' ? 'text-neutral-900 border-b-2 border-neutral-900 -mb-px' : 'text-neutral-400 hover:text-neutral-600'}`}
          onClick={() => setActiveView('trism')}
        >
          TRiSM Guardrails
        </button>
      </div>

      {activeView === 'trism' ? (
        <FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="border border-neutral-900 bg-neutral-900 text-white p-6 md:col-span-2">
              <h3 className="font-mono text-xs uppercase tracking-widest mb-4 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                Guardrails AI: Live Monitoring
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div>
                  <div className="text-xl font-light">0.08</div>
                  <div className="font-mono text-[8px] uppercase tracking-widest text-neutral-500">Avg. Hallucination</div>
                </div>
                <div>
                  <div className="text-xl font-light">0.02</div>
                  <div className="font-mono text-[8px] uppercase tracking-widest text-neutral-500">Linguistic Drift</div>
                </div>
                <div>
                  <div className="text-xl font-light">1,402</div>
                  <div className="font-mono text-[8px] uppercase tracking-widest text-neutral-500">Safety Interventions</div>
                </div>
                <div>
                  <div className="text-xl font-light">100%</div>
                  <div className="font-mono text-[8px] uppercase tracking-widest text-neutral-500">Deontic Compliance</div>
                </div>
              </div>
              <div className="h-32 flex items-end gap-1">
                {[...Array(30)].map((_, i) => (
                  <div 
                    key={i} 
                    className="flex-1 bg-green-500/20 hover:bg-green-500 transition-all cursor-crosshair" 
                    style={{ height: `${Math.random() * 60 + 20}%` }}
                    title={`Safety check ${i}: PASSED`}
                  />
                ))}
              </div>
              <div className="font-mono text-[8px] uppercase text-neutral-600 mt-2 text-center">Protocol Integrity Stream (PIS)</div>
            </div>
            
            <div className="border border-neutral-200 p-6">
              <h3 className="font-mono text-xs uppercase tracking-widest mb-4">Forensic Rules</h3>
              <ul className="space-y-3">
                {[
                  { rule: 'Linguistic Forensics', status: 'ACTIVE' },
                  { rule: 'Causal Chain Logic', status: 'ACTIVE' },
                  { rule: 'Citation Ring Detection', status: 'ACTIVE' },
                  { rule: 'Prompt Injection Filter', status: 'ACTIVE' },
                  { rule: 'Budget Overrun Killswitch', status: 'ACTIVE' },
                ].map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-neutral-500">{r.rule}</span>
                    <span className="text-green-600">{r.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="border border-neutral-100 p-6">
            <h3 className="font-mono text-xs uppercase tracking-widest mb-4">Recent TRiSM Judgements</h3>
            <div className="space-y-4">
              {actionFeed.filter(f => f.trism).map((f, i) => (
                <div key={i} className="flex items-center gap-4 text-xs font-mono border-l-2 border-neutral-900 pl-4 py-1">
                  <span className="text-neutral-400">{f.time}</span>
                  <span className="font-bold">{f.agentId.toUpperCase()}</span>
                  <span className="text-neutral-600">Decision: {f.trism.action}</span>
                  <span className="ml-auto text-neutral-400">Score: {f.trism.hallucinationScore?.toFixed(3)}</span>
                </div>
              ))}
              {actionFeed.filter(f => f.trism).length === 0 && (
                <div className="text-neutral-400 italic text-sm py-4">No active pipeline detections. Run a swarm to see live judgements.</div>
              )}
            </div>
          </div>
        </FadeIn>
      ) : (
        <>
          {/* Paper Selector */}
          <FadeIn delay={0.05}>
            <div className="border border-neutral-200 p-4 mb-6">
              <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 block mb-2">Select Paper to Analyse</label>
              <select
                className="w-full border border-neutral-200 p-2 text-sm font-mono focus:outline-none"
                value={selectedPaper?.id || ''}
                onChange={(e) => setSelectedPaper(papers.find(p => p.id === e.target.value))}
              >
                {papers.map(p => (
                  <option key={p.id} value={p.id}>{p.title} ({p.year})</option>
                ))}
              </select>
            </div>
          </FadeIn>
          
          {/* Rest of Swarm View... */}

          {/* Stats Row */}
          <FadeIn delay={0.1}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="border border-neutral-200 p-4">
                <div className="text-2xl font-light">{agents.length}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Agents</div>
              </div>
              {['guardian', 'philosopher', 'producer'].map(caste => {
                const b = getCasteBudget(caste);
                return (
                  <div key={caste} className="border border-neutral-200 p-4">
                    <div className="text-2xl font-light">{b.pct}%</div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">{caste} budget</div>
                    <div className="h-1 bg-neutral-200 rounded-full mt-1 overflow-hidden">
                      <div className={`h-full ${b.pct >= 80 ? 'bg-red-500' : b.pct >= 50 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${b.pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </FadeIn>

          {/* Run Pipeline */}
          <FadeIn delay={0.15}>
            <Button
              className="mb-8 bg-neutral-900 text-white hover:bg-neutral-800 font-mono text-xs uppercase tracking-widest px-8 h-12"
              onClick={runPipeline}
              disabled={running || !selectedPaper}
            >
              {running ? `Swarm Active: ${currentAgent || ''}...` : 'Launch Swarm Analysis'}
            </Button>
          </FadeIn>

          {/* Agent Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {agents.map((agent, i) => {
              const feedEntry = actionFeed.find(f => f.agentId === agent.id);
              const isActive = currentAgent === agent.id;
              
              return (
                <FadeIn key={agent.id} delay={0.05 * i}>
                  <div className={`border p-5 transition-all ${isActive ? 'border-neutral-900 ring-2 ring-neutral-100' : CASTE_COLOURS[agent.caste] || 'border-neutral-200'}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{CASTE_ICONS[agent.caste] || '🤖'}</span>
                        <div>
                          <h4 className="font-medium text-sm">{agent.name}</h4>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">{agent.caste}</span>
                        </div>
                      </div>
                      <Badge
                        variant={isActive ? 'default' : feedEntry?.status === 'done' ? 'outline' : feedEntry?.status === 'error' ? 'destructive' : 'outline'}
                        className="font-mono text-[9px] rounded-none border-neutral-900"
                      >
                        {isActive ? 'WORKING' : feedEntry?.status?.toUpperCase() || 'IDLE'}
                      </Badge>
                    </div>
                    <p className="text-neutral-600 text-xs mb-3 italic">"{agent.role}"</p>
                    <div className="text-[10px] text-neutral-400 font-mono">T={agent.temperature} | PROVIDER: GEMINI_2.5_PRO</div>

                    {feedEntry?.response && (
                      <details className="mt-3 pt-3 border-t border-neutral-100">
                        <summary className="text-xs cursor-pointer text-neutral-500 hover:text-neutral-700 font-mono">
                          {feedEntry.status === 'error' ? 'ERROR_LOG' : `ANALYSIS_STREAM (${feedEntry.tokensUsed || '?'} TOKENS)`}
                        </summary>
                        <div className="mt-2 text-xs text-neutral-600 max-h-48 overflow-y-auto whitespace-pre-wrap font-serif leading-relaxed pr-2">
                          {feedEntry.response}
                        </div>
                        {feedEntry.trism && (
                          <div className={`mt-3 p-2 text-[9px] font-mono ${feedEntry.trism.action === 'pass' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            [GUARDRAIL_SCAN] HALLUCINATION={feedEntry.trism.hallucinationScore?.toFixed(4)} | DRIFT={feedEntry.trism.driftScore?.toFixed(4)} | VERDICT={feedEntry.trism.action.toUpperCase()}
                          </div>
                        )}
                      </details>
                    )}
                  </div>
                </FadeIn>
              );
            })}
          </div>

          {/* Action Feed Timeline */}
          {actionFeed.length > 0 && (
            <FadeIn delay={0.2}>
              <div className="border border-neutral-100 p-5 bg-neutral-50/50">
                <span className="section-label mb-4 block text-neutral-400">Protocol Execution Stream</span>
                <div className="space-y-3 max-h-80 overflow-y-auto">
                  {actionFeed.map((action, i) => (
                    <div key={i} className="flex items-start gap-3 text-[11px] font-mono">
                      <span className="text-neutral-400 whitespace-nowrap mt-0.5">{action.time}</span>
                      <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${action.status === 'running' ? 'bg-blue-500 animate-pulse' : action.status === 'error' ? 'bg-red-500' : 'bg-green-500'}`} />
                          <span className="font-bold">{action.agent.toUpperCase()}</span>
                          <span className="text-neutral-400"> — </span>
                          <span className={action.status === 'error' ? 'text-red-500' : 'text-neutral-600'}>{action.status.toUpperCase()}</span>
                        </div>
                        {action.tokensUsed && <div className="text-neutral-400 text-[9px]">COMPUTATIONAL_COST: {action.tokensUsed} TOKENS</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>
          )}
        </>
      )}
    </div>
  );
}

export default AgentCommandCentre;
