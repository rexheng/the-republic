import React, { useState, useEffect, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { getPaperInfo } from '../utils/paperTechniqueMap';
import '../styles/tabs.css';
import '../styles/agents.css';

const PIPELINE_STEPS = [
  { key: 'download', label: 'Download' },
  { key: 'explore', label: 'Explore' },
  { key: 'paper_search', label: 'Paper Search' },
  { key: 'experiment', label: 'Experiments' },
  { key: 'submit', label: 'Submit' },
];

const KaggleLab = () => {
  const [competition, setCompetition] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [stages, setStages] = useState({
    download: { status: 'pending', logs: [] },
    explore: { status: 'pending', logs: [] },
    paper_search: { status: 'pending', logs: [] },
    experiment: { status: 'pending', logs: [] },
    submit: { status: 'pending', logs: [] },
  });
  const [matchedPapers, setMatchedPapers] = useState([]);
  const [experiments, setExperiments] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [bestExperiment, setBestExperiment] = useState(null);
  const [knowledgeGraph, setKnowledgeGraph] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const wsRef = useRef(null);
  const graphRef = useRef(null);

  // Fetch knowledge graph from API
  const fetchKnowledgeGraph = useCallback(async () => {
    if (!competition) return;
    try {
      const response = await fetch(`http://localhost:3001/api/kaggle/knowledge-graph/${competition}`);
      if (response.ok) {
        const kg = await response.json();
        setKnowledgeGraph(kg);
      }
    } catch (error) {
      console.error('Error fetching knowledge graph:', error);
    }
  }, [competition]);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => console.log('Connected to WebSocket');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      // Update pipeline stage status
      const stageKey = data.stage;
      if (stageKey && ['download', 'explore', 'paper_search', 'experiment', 'submit'].includes(stageKey)) {
        setStages(prev => ({
          ...prev,
          [stageKey]: {
            status: data.status,
            logs: [...(prev[stageKey]?.logs || []), {
              message: data.message,
              timestamp: data.timestamp,
            }].slice(-50),
          },
        }));
      }

      // Handle paper-matched events
      if (data.event === 'paper_matched') {
        setMatchedPapers(prev => [...prev, {
          paperId: data.paperId,
          paperTitle: data.paperTitle,
          technique: data.technique,
          reason: data.reason,
        }]);
      }

      // Handle experiment-start: dynamically add agent cards
      if (data.event === 'experiment_start') {
        setExperiments(prev => {
          const exists = prev.find(e => e.id === data.experimentId);
          if (exists) {
            return prev.map(e => e.id === data.experimentId
              ? { ...e, status: 'running', logs: [...e.logs, { message: `Starting: ${data.strategy}`, timestamp: data.timestamp }].slice(-5) }
              : e
            );
          }
          return [...prev, {
            id: data.experimentId,
            paperId: data.paperId,
            paperTitle: data.paperTitle,
            technique: data.technique,
            strategy: data.strategy,
            status: 'running',
            cvScore: null,
            std: null,
            model: null,
            featuresUsed: null,
            logs: [{ message: `Starting: ${data.strategy}`, timestamp: data.timestamp }],
          }];
        });
      }

      // Experiment log
      if (data.event === 'experiment_log') {
        setExperiments(prev => prev.map(exp =>
          exp.id === data.experimentId
            ? { ...exp, logs: [...exp.logs, { message: data.message, timestamp: data.timestamp }].slice(-5) }
            : exp
        ));
      }

      // Experiment result
      if (data.event === 'experiment_result') {
        setExperiments(prev => prev.map(exp =>
          exp.id === data.experimentId
            ? {
              ...exp,
              status: 'done',
              cvScore: data.cvScore,
              std: data.std,
              model: data.model,
              featuresUsed: data.featuresUsed,
              logs: [...exp.logs, { message: `CV=${data.cvScore} (+/-${data.std})`, timestamp: data.timestamp }].slice(-5),
            }
            : exp
        ));
        setLeaderboard(prev => {
          const updated = [...prev, {
            id: data.experimentId,
            paperId: data.paperId,
            technique: data.technique,
            cvScore: data.cvScore,
            std: data.std,
            model: data.model,
            featuresUsed: data.featuresUsed,
          }];
          return updated.sort((a, b) => b.cvScore - a.cvScore);
        });
      }

      // Best selected
      if (data.event === 'best_selected') {
        setBestExperiment({
          id: data.experimentId,
          paperId: data.paperId,
          name: data.experimentName,
          cvScore: data.cvScore,
        });
      }

      // Submission ready
      if (data.event === 'submission_ready') {
        setIsRunning(false);
      }

      // Knowledge graph built — fetch it
      if (data.event === 'knowledge_graph_built') {
        fetchKnowledgeGraph();
      }

      // Pipeline completed or errored
      if (data.status === 'completed' && data.stage === 'submit') {
        setIsRunning(false);
      }
      if (data.status === 'error') {
        setIsRunning(false);
      }
    };

    ws.onerror = (error) => console.error('WebSocket error:', error);
    ws.onclose = () => console.log('WebSocket disconnected');
    wsRef.current = ws;

    return () => ws.close();
  }, [fetchKnowledgeGraph]);

  const startPipeline = async () => {
    if (!competition.trim()) {
      alert('Please enter a competition name');
      return;
    }

    // Reset state
    setStages({
      download: { status: 'pending', logs: [] },
      explore: { status: 'pending', logs: [] },
      paper_search: { status: 'pending', logs: [] },
      experiment: { status: 'pending', logs: [] },
      submit: { status: 'pending', logs: [] },
    });
    setMatchedPapers([]);
    setExperiments([]);
    setLeaderboard([]);
    setBestExperiment(null);
    setKnowledgeGraph(null);
    setIsRunning(true);

    try {
      const response = await fetch('http://localhost:3001/api/kaggle/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competition: competition.trim(), apiToken: apiToken.trim() }),
      });
      const data = await response.json();
      setSessionId(data.sessionId);
    } catch (error) {
      console.error('Error starting pipeline:', error);
      alert('Failed to start pipeline. Make sure backend is running on port 3001');
      setIsRunning(false);
    }
  };

  const downloadSubmission = async () => {
    if (!competition) return;
    try {
      const response = await fetch(`http://localhost:3001/api/kaggle/submission/${competition}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'submission.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading submission:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return '⏳';
      case 'running': return '🔄';
      case 'completed': return '✅';
      case 'done': return '✅';
      case 'error': return '❌';
      default: return '⏳';
    }
  };

  // Knowledge graph node color
  const getNodeColor = (node) => {
    if (node.type === 'paper') return '#3b82f6';
    if (node.type === 'technique') return '#a855f7';
    if (node.status === 'winner') return '#f59e0b';
    if (node.status === 'proven') return '#10b981';
    if (node.status === 'unproven') return '#ef4444';
    return '#6b7280';
  };

  const getNodeSize = (node) => {
    if (node.is_winner) return 8;
    if (node.type === 'paper') return 6;
    if (node.type === 'technique') return 5;
    return 4;
  };

  // Prepare graph data for react-force-graph-2d
  const graphData = knowledgeGraph ? {
    nodes: knowledgeGraph.nodes.map(n => ({ ...n, val: getNodeSize(n) })),
    links: knowledgeGraph.edges.map(e => ({ source: e.source, target: e.target, type: e.type })),
  } : { nodes: [], links: [] };

  // ──────────────── Render ────────────────

  return (
    <div className="tab-content">
      {/* Header */}
      <div className="kaggle-header">
        <h2>🏆 Kaggle Agent Lab</h2>
        <p>Paper-driven AI agents — Search papers → Match techniques → Run experiments → Build knowledge graph</p>
      </div>

      {/* Control Panel */}
      <div className="kaggle-control-panel">
        <div className="control-row">
          <div className="control-field">
            <label>Competition Name</label>
            <input
              type="text"
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
              placeholder='e.g., titanic'
              disabled={isRunning}
            />
            <small>Enter the competition slug from Kaggle</small>
          </div>
          <div className="control-field">
            <label>Kaggle API Token (Optional)</label>
            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="KGAT_..."
              disabled={isRunning}
            />
            <small>From kaggle.com/settings → API</small>
          </div>
        </div>
        <div className="control-actions">
          <button
            className={`btn-launch ${isRunning ? 'btn-disabled' : ''}`}
            onClick={startPipeline}
            disabled={isRunning}
          >
            {isRunning ? '🔄 Agents Running...' : '🚀 Launch Agents'}
          </button>
          {bestExperiment && (
            <button className="btn-download" onClick={downloadSubmission}>
              📥 Download Submission
            </button>
          )}
        </div>
        {sessionId && <div className="session-id">Session: {sessionId}</div>}
      </div>

      {/* Pipeline Progress */}
      <div className="pipeline-progress">
        {PIPELINE_STEPS.map((step, idx) => {
          const stageStatus = stages[step.key]?.status || 'pending';
          return (
            <React.Fragment key={step.key}>
              <div className={`pipeline-step pipeline-step-${stageStatus}`}>
                <div className="pipeline-step-icon">{getStatusIcon(stageStatus)}</div>
                <div className="pipeline-step-label">{step.label}</div>
              </div>
              {idx < PIPELINE_STEPS.length - 1 && (
                <div className={`pipeline-connector ${stageStatus === 'completed' ? 'pipeline-connector-done' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Paper Discovery Panel */}
      {matchedPapers.length > 0 && (
        <div className="paper-discovery-section">
          <h3>📚 Paper Discovery — {matchedPapers.length} Techniques Matched</h3>
          <div className="paper-match-grid">
            {matchedPapers.map((paper, idx) => {
              const info = getPaperInfo(paper.paperId);
              return (
                <div key={idx} className="paper-match-card" style={{ borderLeftColor: info.color }}>
                  <div className="paper-match-header">
                    <span className="paper-match-icon">{info.icon}</span>
                    <div className="paper-match-title">
                      <span className="paper-match-technique">{paper.technique}</span>
                      <span className="paper-match-id">{paper.paperId}</span>
                    </div>
                    <span className="paper-match-tag" style={{ background: info.color + '20', color: info.color }}>
                      {info.tag}
                    </span>
                  </div>
                  <div className="paper-match-reason">{paper.reason}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Agent Cards Grid (dynamic) */}
      {experiments.length > 0 && (
        <div className="agent-cards-grid">
          {experiments.map(exp => {
            const info = getPaperInfo(exp.paperId);
            const isWinner = bestExperiment && bestExperiment.id === exp.id;
            return (
              <div key={exp.id} className={`agent-card agent-card-${exp.status} ${isWinner ? 'agent-card-winner' : ''}`}>
                <div className="agent-card-header">
                  <span className="agent-card-icon">{info.icon}</span>
                  <div className="agent-card-title">
                    <h3>{exp.technique}</h3>
                    <span className="agent-card-strategy">{exp.strategy}</span>
                  </div>
                  <span className={`agent-card-badge agent-badge-${exp.status}`}>
                    {exp.status === 'pending' ? 'Waiting' : exp.status === 'running' ? 'Running' : exp.status === 'done' ? 'Done' : exp.status}
                  </span>
                </div>

                <div className="agent-card-paper-ref">
                  Inspired by: <strong>{exp.paperId}</strong>
                </div>

                {exp.cvScore !== null && (
                  <div className="agent-card-score">
                    <div className="score-value">{exp.cvScore.toFixed(4)}</div>
                    <div className="score-label">CV Score (+/-{exp.std?.toFixed(3)})</div>
                    <div className="score-meta">{exp.model} · {exp.featuresUsed} features</div>
                  </div>
                )}

                {exp.logs.length > 0 && (
                  <div className="agent-card-logs">
                    {exp.logs.map((log, idx) => (
                      <div key={idx} className="agent-log-entry">
                        <span className="agent-log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="agent-log-msg">{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div className="leaderboard-section">
          <h3>📊 Leaderboard</h3>
          <table className="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Paper</th>
                <th>Technique</th>
                <th>CV Score</th>
                <th>Std</th>
                <th>Features</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
                return (
                  <tr key={entry.id} className={bestExperiment && bestExperiment.id === entry.id ? 'leaderboard-winner' : ''}>
                    <td>{medal}</td>
                    <td><code>{entry.paperId}</code></td>
                    <td>{entry.technique}</td>
                    <td className="score-cell">{entry.cvScore.toFixed(4)}</td>
                    <td>{entry.std.toFixed(4)}</td>
                    <td>{entry.featuresUsed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Winner Banner */}
      {bestExperiment && (
        <div className="winner-banner">
          <div className="winner-trophy">🏆</div>
          <div className="winner-info">
            <div className="winner-title">Winner: {bestExperiment.name}</div>
            <div className="winner-paper">Paper: {bestExperiment.paperId}</div>
            <div className="winner-score">CV Score: {bestExperiment.cvScore.toFixed(4)}</div>
          </div>
          <button className="btn-download" onClick={downloadSubmission}>
            📥 Download Submission
          </button>
        </div>
      )}

      {/* Knowledge Graph */}
      {knowledgeGraph && (
        <div className="kg-section">
          <h3>🧠 Knowledge Graph</h3>
          <div className="kg-legend">
            <span className="kg-legend-item"><span className="kg-dot" style={{ background: '#3b82f6' }} /> Paper</span>
            <span className="kg-legend-item"><span className="kg-dot" style={{ background: '#a855f7' }} /> Technique</span>
            <span className="kg-legend-item"><span className="kg-dot" style={{ background: '#10b981' }} /> Proven</span>
            <span className="kg-legend-item"><span className="kg-dot" style={{ background: '#ef4444' }} /> Unproven</span>
            <span className="kg-legend-item"><span className="kg-dot" style={{ background: '#f59e0b' }} /> Winner</span>
          </div>
          <div className="kg-stats">
            {knowledgeGraph.nodes.length} nodes · {knowledgeGraph.edges.length} edges · Baseline: {knowledgeGraph.baseline_score} · Best: {knowledgeGraph.best_score}
          </div>
          <div className="kg-container">
            <ForceGraph2D
              ref={graphRef}
              graphData={graphData}
              nodeColor={getNodeColor}
              nodeRelSize={6}
              nodeLabel={n => `${n.label}${n.cv_score ? ` (CV=${n.cv_score})` : ''}`}
              linkColor={() => '#cbd5e1'}
              linkWidth={1.5}
              linkDirectionalArrowLength={4}
              linkDirectionalArrowRelPos={1}
              width={800}
              height={400}
              backgroundColor="#f8fafc"
              nodeCanvasObject={(node, ctx, globalScale) => {
                const size = node.val || 4;
                const fontSize = 10 / globalScale;
                const color = getNodeColor(node);

                // Draw node circle
                ctx.beginPath();
                ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();

                if (node.is_winner) {
                  ctx.strokeStyle = '#f59e0b';
                  ctx.lineWidth = 2 / globalScale;
                  ctx.stroke();
                }

                // Draw label
                if (globalScale > 0.8) {
                  const label = node.label || '';
                  ctx.font = `${fontSize}px sans-serif`;
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'top';
                  ctx.fillStyle = '#374151';
                  ctx.fillText(label.substring(0, 25), node.x, node.y + size + 2);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Pipeline Logs */}
      {(stages.download.logs.length > 0 || stages.explore.logs.length > 0) && (
        <div className="pipeline-logs-section">
          <h3>📋 Pipeline Logs</h3>
          <div className="pipeline-logs">
            {['download', 'explore'].map(stageKey => (
              stages[stageKey].logs.length > 0 && (
                <div key={stageKey} className="pipeline-log-group">
                  <div className="pipeline-log-title">{stageKey === 'download' ? 'Download' : 'Explore'}</div>
                  {stages[stageKey].logs.slice(-8).map((log, idx) => (
                    <div key={idx} className="pipeline-log-entry">
                      <span className="pipeline-log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                      <span>{log.message}</span>
                    </div>
                  ))}
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default KaggleLab;
