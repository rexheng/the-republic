import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RALPHEngine } from '../utils/ralphEngine';
import { FRONTIER_AGENTS } from '../utils/frontierDefinitions';
import FrontierReport from './FrontierReport';
import VerificationPanel from './VerificationPanel';
import CheckpointDialog from './CheckpointDialog';

function buildInitialAgentStates() {
  return Object.fromEntries(
    FRONTIER_AGENTS.map(a => [a.id, { status: 'pending', output: null, duration: null }])
  );
}

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatDuration(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

const HEALTH_DOT_COLORS = { healthy: '#38a169', warning: '#d69e2e', critical: '#e53e3e' };

function RALPHMode({ seedPapers, hasApiKey }) {
  const engineRef = useRef(null);
  const elapsedRef = useRef(null);
  const startTimeRef = useRef(null);

  const [status, setStatus] = useState('idle');
  const [guidance, setGuidance] = useState('');
  const [iterations, setIterations] = useState([]);
  const [queueLength, setQueueLength] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [currentIteration, setCurrentIteration] = useState(null);
  const [agentStates, setAgentStates] = useState(buildInitialAgentStates());
  const [expandedIteration, setExpandedIteration] = useState(null);
  const [stats, setStats] = useState(null);

  // Verification state
  const [verificationStats, setVerificationStats] = useState(null);
  const [activeCheckpoint, setActiveCheckpoint] = useState(null);
  const [verificationSettings, setVerificationSettings] = useState({
    enabled: true,
    checkpointInterval: 5,
    pauseOnCritical: true,
    runHypothesisCheck: true,
    runSourceCheck: true,
    runLoopQuality: true,
  });

  // Create engine once
  useEffect(() => {
    const engine = new RALPHEngine({
      onStatusChange: (s) => setStatus(s),
      onIterationStart: (id, papers) => {
        setCurrentIteration({ id, papers });
        setAgentStates(buildInitialAgentStates());
      },
      onIterationComplete: (iteration) => {
        setIterations(prev => [iteration, ...prev]);
        setCurrentIteration(null);
        setAgentStates(buildInitialAgentStates());
      },
      onAgentUpdate: (agentId, updates) => {
        setAgentStates(prev => ({
          ...prev,
          [agentId]: { ...prev[agentId], ...updates },
        }));
      },
      onQueueChange: (queue) => setQueueLength(queue.length),
      onCooldown: (remaining) => setCooldown(remaining),
      onVerificationComplete: (iterationId, verification) => {
        // Update the iteration in state with verification data
        setIterations(prev => prev.map(it =>
          it.id === iterationId ? { ...it, verification } : it
        ));
      },
      onCheckpointTriggered: (checkpoint) => {
        setActiveCheckpoint(checkpoint);
      },
      onVerificationStatsUpdate: (stats) => {
        setVerificationStats(stats);
      },
    });
    engineRef.current = engine;

    return () => {
      engine.stop();
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, []);

  // Sync verification settings to engine
  useEffect(() => {
    if (engineRef.current) {
      engineRef.current.setVerificationSettings(verificationSettings);
    }
  }, [verificationSettings]);

  // Update accumulated stats when iterations change
  useEffect(() => {
    if (engineRef.current && iterations.length > 0) {
      setStats(engineRef.current.getAccumulatedStats());
    }
  }, [iterations]);

  // Elapsed timer
  useEffect(() => {
    if (status === 'running') {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      elapsedRef.current = setInterval(() => {
        setElapsed(Date.now() - startTimeRef.current);
      }, 1000);
    } else if (status === 'paused' || status === 'checkpoint') {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    } else if (status === 'stopped' || status === 'idle') {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    }
    return () => {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    };
  }, [status]);

  const handleStart = useCallback(() => {
    if (!seedPapers || seedPapers.length === 0) return;
    startTimeRef.current = Date.now();
    setElapsed(0);
    setIterations([]);
    setStats(null);
    setVerificationStats(null);
    setExpandedIteration(null);
    setActiveCheckpoint(null);
    engineRef.current?.start(seedPapers, { guidance });
  }, [seedPapers, guidance]);

  const handlePause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const handleResume = useCallback(() => {
    engineRef.current?.resume();
  }, []);

  const handleStop = useCallback(() => {
    engineRef.current?.stop();
    setActiveCheckpoint(null);
  }, []);

  // Checkpoint handlers
  const handleCheckpointContinue = useCallback((feedback) => {
    engineRef.current?.resolveCheckpoint('continue', feedback);
    setActiveCheckpoint(null);
  }, []);

  const handleCheckpointRedirect = useCallback((feedback, newGuidance) => {
    engineRef.current?.resolveCheckpoint('redirect', feedback, newGuidance);
    setGuidance(newGuidance);
    setActiveCheckpoint(null);
  }, []);

  const handleCheckpointStop = useCallback((feedback) => {
    engineRef.current?.resolveCheckpoint('stop', feedback);
    setActiveCheckpoint(null);
  }, []);

  const exportFullRun = useCallback(() => {
    if (!engineRef.current) return;
    const data = engineRef.current.exportFullRun();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ralph-run-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const copySummary = useCallback(() => {
    if (!stats) return;
    const lines = [
      'RALPH Research Discovery Run',
      `Iterations: ${iterations.length}`,
      `Elapsed: ${formatElapsed(elapsed)}`,
      `Papers Explored: ${stats.totalPapers}`,
      `Gaps Found: ${stats.totalGaps}`,
      `Hypotheses Generated: ${stats.totalHypotheses}`,
      `Experiments Designed: ${stats.totalExperiments}`,
      `Fields Touched: ${stats.fieldsTouched}`,
      `Breakthroughs: ${stats.breakthroughs.length}`,
    ];
    if (verificationStats) {
      lines.push('', '--- Verification ---',
        `Verified: ${verificationStats.verifiedCount}`,
        `Avg Novelty: ${verificationStats.avgNoveltyScore}%`,
        `Avg Trust: ${verificationStats.avgTrustScore}%`,
        `Flags: ${verificationStats.totalHallucinationFlags}`,
      );
    }
    lines.push('', ...stats.breakthroughs.map(b => `* [Iter ${b.iterationId}] ${b.title}`));
    navigator.clipboard.writeText(lines.join('\n'));
  }, [stats, iterations, elapsed, verificationStats]);

  // Get top highlight from an iteration report
  const getHighlight = (report) => {
    if (!report) return null;
    const bh = (report.hypotheses || []).find(h => h.noveltyLevel === 'breakthrough');
    if (bh) return bh.title;
    const critGap = (report.gaps || []).find(g => g.severity === 'critical');
    if (critGap) return critGap.gap?.split(/\s+/).slice(0, 10).join(' ');
    const dir = (report.emergingDirections || []).find(d => d.potential === 'high');
    if (dir) return dir.direction;
    return null;
  };

  if (!hasApiKey) {
    return (
      <div className="ralph-empty">
        <p>Set up an API key in the Research Navigator first.</p>
      </div>
    );
  }

  if (!seedPapers || seedPapers.length === 0) {
    return (
      <div className="ralph-empty">
        <div className="ralph-empty-icon">{'\uD83D\uDD04'}</div>
        <h2>RALPH</h2>
        <p>Research Autonomous Loop for Progressive Hypotheses</p>
        <p className="lab-empty-sub">
          Select 1-5 seed papers from the left panel. RALPH will autonomously discover research frontiers,
          fetch related papers, and loop — building a map of what areas of science will be solved.
        </p>
      </div>
    );
  }

  const isRunning = status === 'running' || status === 'paused' || status === 'checkpoint';

  return (
    <div className="ralph-dashboard">
      {/* Research Direction */}
      <div className="ralph-guidance">
        <label className="ralph-guidance-label">Research Direction</label>
        <textarea
          className="ralph-guidance-input"
          placeholder="e.g. &quot;Find a path to solving protein-drug interaction prediction using graph neural networks and molecular dynamics&quot;"
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          disabled={isRunning}
          rows={2}
        />
        {guidance && !isRunning && (
          <div className="ralph-guidance-hint">
            RALPH will steer discovery toward this goal — biasing agent analysis, paper fetching, and scoring.
          </div>
        )}
      </div>

      {/* Verification Settings */}
      <div className="ralph-verify-settings">
        <label className="ralph-verify-settings-label">Verification</label>
        <div className="ralph-verify-toggles">
          <label className="ralph-verify-toggle">
            <input
              type="checkbox"
              checked={verificationSettings.enabled}
              onChange={(e) => setVerificationSettings(s => ({ ...s, enabled: e.target.checked }))}
              disabled={isRunning}
            />
            <span>Enabled</span>
          </label>
          <label className="ralph-verify-toggle">
            <input
              type="checkbox"
              checked={verificationSettings.runHypothesisCheck}
              onChange={(e) => setVerificationSettings(s => ({ ...s, runHypothesisCheck: e.target.checked }))}
              disabled={isRunning || !verificationSettings.enabled}
            />
            <span>Hypothesis Check (+1 LLM call)</span>
          </label>
          <label className="ralph-verify-toggle">
            <input
              type="checkbox"
              checked={verificationSettings.runSourceCheck}
              onChange={(e) => setVerificationSettings(s => ({ ...s, runSourceCheck: e.target.checked }))}
              disabled={isRunning || !verificationSettings.enabled}
            />
            <span>Source Check</span>
          </label>
          <label className="ralph-verify-toggle">
            <input
              type="checkbox"
              checked={verificationSettings.runLoopQuality}
              onChange={(e) => setVerificationSettings(s => ({ ...s, runLoopQuality: e.target.checked }))}
              disabled={isRunning || !verificationSettings.enabled}
            />
            <span>Loop Quality</span>
          </label>
          <label className="ralph-verify-toggle">
            <input
              type="checkbox"
              checked={verificationSettings.pauseOnCritical}
              onChange={(e) => setVerificationSettings(s => ({ ...s, pauseOnCritical: e.target.checked }))}
              disabled={isRunning || !verificationSettings.enabled}
            />
            <span>Pause on Critical</span>
          </label>
          <label className="ralph-verify-toggle ralph-verify-interval">
            <span>Checkpoint every</span>
            <input
              type="number"
              min={2}
              max={50}
              value={verificationSettings.checkpointInterval}
              onChange={(e) => setVerificationSettings(s => ({ ...s, checkpointInterval: parseInt(e.target.value) || 5 }))}
              disabled={isRunning || !verificationSettings.enabled}
            />
            <span>iterations</span>
          </label>
        </div>
      </div>

      {/* Control Bar */}
      <div className="ralph-control-bar">
        <div className="ralph-controls">
          {status === 'idle' || status === 'stopped' ? (
            <button className="ralph-btn ralph-btn-start" onClick={handleStart}>
              {'\u25B6'} Start RALPH
            </button>
          ) : status === 'running' ? (
            <>
              <button className="ralph-btn ralph-btn-pause" onClick={handlePause}>
                {'\u23F8'} Pause
              </button>
              <button className="ralph-btn ralph-btn-stop" onClick={handleStop}>
                {'\u23F9'} Stop
              </button>
            </>
          ) : status === 'paused' ? (
            <>
              <button className="ralph-btn ralph-btn-start" onClick={handleResume}>
                {'\u25B6'} Resume
              </button>
              <button className="ralph-btn ralph-btn-stop" onClick={handleStop}>
                {'\u23F9'} Stop
              </button>
            </>
          ) : status === 'checkpoint' ? (
            <span className="ralph-checkpoint-badge">Checkpoint Review...</span>
          ) : null}
        </div>
        <div className="ralph-stats-row">
          <span className="ralph-stat">
            <strong>Iter:</strong> {iterations.length}
          </span>
          <span className="ralph-elapsed">
            {formatElapsed(elapsed)}
          </span>
          <span className="ralph-queue-badge">
            Queue: {queueLength}
          </span>
          {cooldown > 0 && (
            <span className="ralph-cooldown">
              Cooldown: {Math.ceil(cooldown / 1000)}s
            </span>
          )}
        </div>
      </div>

      {/* Live Iteration */}
      {currentIteration && (
        <div className="ralph-live-section">
          <div className="ralph-live-header">
            <span className="ralph-live-dot" />
            LIVE: Running iteration {currentIteration.id}...
          </div>
          <div className="ralph-live-papers">
            {currentIteration.papers.map((p, i) => (
              <span key={i} className="ralph-live-paper">
                {p.title?.length > 50 ? p.title.slice(0, 50) + '...' : p.title}
              </span>
            ))}
          </div>
          <div className="ralph-mini-pipeline">
            {FRONTIER_AGENTS.map((agent, i) => (
              <React.Fragment key={agent.id}>
                {i > 0 && <span className="ralph-mini-arrow">{'\u2192'}</span>}
                <span className={`ralph-mini-node ${
                  agentStates[agent.id]?.status === 'working' ? 'ralph-node-active' :
                  agentStates[agent.id]?.status === 'complete' ? 'ralph-node-done' :
                  agentStates[agent.id]?.status === 'error' ? 'ralph-node-error' : ''
                }`} style={{ borderColor: agent.color }} title={agent.name}>
                  {agent.emoji}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Discovery Timeline */}
      {iterations.length > 0 && (
        <div className="ralph-timeline-section">
          <h3 className="ralph-section-title">Discovery Timeline</h3>
          <div className="ralph-timeline">
            {iterations.map(iter => {
              const highlight = getHighlight(iter.report);
              const gapCount = (iter.report?.gaps || []).length;
              const hypothesisCount = (iter.report?.hypotheses || []).length;
              const isExpanded = expandedIteration === iter.id;
              const health = iter.verification?.loopQuality?.overallHealth;

              return (
                <div key={iter.id} className="ralph-iteration-card">
                  <div
                    className="ralph-iter-header"
                    onClick={() => setExpandedIteration(isExpanded ? null : iter.id)}
                  >
                    <div className="ralph-iter-left">
                      {health && (
                        <span
                          className="ralph-health-dot"
                          style={{ background: HEALTH_DOT_COLORS[health] || '#a0aec0' }}
                          title={`Loop health: ${health}`}
                        />
                      )}
                      <span className="ralph-iter-number">Iter {iter.id}</span>
                      <span className="ralph-iter-duration">({formatDuration(iter.durationMs)})</span>
                      <span className="ralph-iter-stats">
                        {gapCount} gaps, {hypothesisCount} hypotheses
                      </span>
                    </div>
                    <span className="ralph-iter-toggle">{isExpanded ? '\u25B2' : '\u25BC'}</span>
                  </div>
                  {highlight && (
                    <div className="ralph-highlight">
                      {'\u2605'} {highlight}
                    </div>
                  )}
                  <div className="ralph-iter-meta">
                    Papers: {iter.papers.map(p => p.title?.slice(0, 30)).join(', ')}
                    {iter.newPapersFound > 0 && (
                      <span className="ralph-new-papers">+{iter.newPapersFound} papers queued</span>
                    )}
                  </div>
                  {isExpanded && iter.report && (
                    <div className="ralph-iter-expanded">
                      <FrontierReport report={iter.report} />
                      {iter.verification && <VerificationPanel verification={iter.verification} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Accumulated Insights */}
      {stats && (
        <div className="ralph-accumulated">
          <h3 className="ralph-section-title">Accumulated Insights</h3>
          <div className="ralph-stats-grid">
            <div className="ralph-stat-card">
              <span className="ralph-stat-value">{stats.totalPapers}</span>
              <span className="ralph-stat-label">Papers</span>
            </div>
            <div className="ralph-stat-card">
              <span className="ralph-stat-value">{stats.totalGaps}</span>
              <span className="ralph-stat-label">Gaps</span>
            </div>
            <div className="ralph-stat-card">
              <span className="ralph-stat-value">{stats.totalHypotheses}</span>
              <span className="ralph-stat-label">Hypotheses</span>
            </div>
            <div className="ralph-stat-card">
              <span className="ralph-stat-value">{stats.totalExperiments}</span>
              <span className="ralph-stat-label">Experiments</span>
            </div>
            <div className="ralph-stat-card">
              <span className="ralph-stat-value">{stats.fieldsTouched}</span>
              <span className="ralph-stat-label">Fields</span>
            </div>
            <div className="ralph-stat-card ralph-stat-breakthrough">
              <span className="ralph-stat-value">{stats.breakthroughs.length}</span>
              <span className="ralph-stat-label">Breakthroughs</span>
            </div>
          </div>

          {/* Verification Summary */}
          {verificationStats && verificationStats.verifiedCount > 0 && (
            <div className="ralph-verify-accumulated">
              <h4>Verification Summary</h4>
              <div className="ralph-stats-grid">
                <div className="ralph-stat-card ralph-stat-verify">
                  <span className="ralph-stat-value">{verificationStats.verifiedCount}</span>
                  <span className="ralph-stat-label">Verified</span>
                </div>
                <div className="ralph-stat-card ralph-stat-verify">
                  <span className="ralph-stat-value">{verificationStats.avgNoveltyScore}%</span>
                  <span className="ralph-stat-label">Avg Novelty</span>
                </div>
                <div className="ralph-stat-card ralph-stat-verify">
                  <span className="ralph-stat-value">{verificationStats.avgTrustScore}%</span>
                  <span className="ralph-stat-label">Avg Trust</span>
                </div>
                <div className="ralph-stat-card ralph-stat-verify">
                  <span className="ralph-stat-value">{verificationStats.totalHallucinationFlags}</span>
                  <span className="ralph-stat-label">Flags</span>
                </div>
              </div>
            </div>
          )}

          {stats.breakthroughs.length > 0 && (
            <div className="ralph-breakthroughs">
              <h4>Top Breakthroughs</h4>
              <ul>
                {stats.breakthroughs.map((b, i) => (
                  <li key={i}>
                    <span className="ralph-bt-iter">Iter {b.iterationId}</span>
                    <span className="ralph-bt-title">{b.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="ralph-export-row">
            <button className="btn btn-small lab-export-btn" onClick={exportFullRun}>
              Export Full Run JSON
            </button>
            <button className="btn btn-small lab-copy-btn" onClick={copySummary}>
              Copy Summary
            </button>
          </div>
        </div>
      )}

      {/* Checkpoint Dialog */}
      {activeCheckpoint && (
        <CheckpointDialog
          checkpoint={activeCheckpoint}
          onContinue={handleCheckpointContinue}
          onRedirect={handleCheckpointRedirect}
          onStop={handleCheckpointStop}
        />
      )}
    </div>
  );
}

export default RALPHMode;
