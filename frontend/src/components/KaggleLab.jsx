import React, { useState, useEffect, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { getPaperInfo } from '../utils/paperTechniqueMap';
import { BACKEND_URL } from '../config';
import { usePyodideLab, PYODIDE_STATES } from '../hooks/usePyodideLab';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { FadeIn } from '@/components/ui/fade-in';
import {
  Trophy, Rocket, Download, RefreshCw, Clock, Check, X, AlertCircle,
  BookOpen, BarChart3, Brain, FileText, Loader2, ServerOff, Upload, Monitor
} from 'lucide-react';

const PIPELINE_STEPS = [
  { key: 'download', label: 'Download' },
  { key: 'explore', label: 'Explore' },
  { key: 'paper_search', label: 'Paper Search' },
  { key: 'experiment', label: 'Experiments' },
  { key: 'submit', label: 'Submit' },
];

const KaggleLab = () => {
  // ─── Mode detection: backend (WebSocket) vs browser (Pyodide) ───
  const [backendOnline, setBackendOnline] = useState(null);
  const useBackendMode = BACKEND_URL && backendOnline === true;

  // ─── Shared UI state ───
  const [competition, setCompetition] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState(null);
  const fileInputRef = useRef(null);
  const graphRef = useRef(null);

  // ─── Backend mode state (WebSocket) ───
  const [sessionId, setSessionId] = useState(null);
  const [backendError, setBackendError] = useState(null);
  const [backendStages, setBackendStages] = useState({
    download: { status: 'pending', logs: [] },
    explore: { status: 'pending', logs: [] },
    paper_search: { status: 'pending', logs: [] },
    experiment: { status: 'pending', logs: [] },
    submit: { status: 'pending', logs: [] },
  });
  const [backendMatchedPapers, setBackendMatchedPapers] = useState([]);
  const [backendExperiments, setBackendExperiments] = useState([]);
  const [backendLeaderboard, setBackendLeaderboard] = useState([]);
  const [backendBestExperiment, setBackendBestExperiment] = useState(null);
  const [backendKnowledgeGraph, setBackendKnowledgeGraph] = useState(null);
  const [backendIsRunning, setBackendIsRunning] = useState(false);
  const wsRef = useRef(null);

  // ─── Browser mode (Pyodide) ───
  const pyodide = usePyodideLab();

  // ─── Unified getters: pick from active mode ───
  const stages = useBackendMode ? backendStages : pyodide.stages;
  const matchedPapers = useBackendMode ? backendMatchedPapers : pyodide.matchedPapers;
  const experiments = useBackendMode ? backendExperiments : pyodide.experiments;
  const leaderboard = useBackendMode ? backendLeaderboard : pyodide.leaderboard;
  const bestExperiment = useBackendMode ? backendBestExperiment : pyodide.bestExperiment;
  const knowledgeGraph = useBackendMode ? backendKnowledgeGraph : pyodide.knowledgeGraph;
  const isRunning = useBackendMode ? backendIsRunning : pyodide.isRunning;
  const error = useBackendMode ? backendError : pyodide.error;

  // Fetch knowledge graph from backend API (backend mode only)
  const fetchKnowledgeGraph = useCallback(async () => {
    if (!competition || !BACKEND_URL) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/kaggle/knowledge-graph/${competition}`);
      if (response.ok) {
        const kg = await response.json();
        setBackendKnowledgeGraph(kg);
      }
    } catch (error) {
      console.error('Error fetching knowledge graph:', error);
    }
  }, [competition]);

  // Check if backend is reachable (optional — browser mode works without it)
  useEffect(() => {
    if (!BACKEND_URL) {
      setBackendOnline(false);
      return;
    }
    const check = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/kaggle/sessions`, { signal: AbortSignal.timeout(3000) });
        setBackendOnline(res.ok);
      } catch {
        setBackendOnline(false);
      }
    };
    check();
  }, []);

  // WebSocket connection (backend mode only)
  useEffect(() => {
    if (!useBackendMode) return;
    const wsUrl = BACKEND_URL.replace(/^http/, 'ws');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {};

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      const stageKey = data.stage;
      if (stageKey && ['download', 'explore', 'paper_search', 'experiment', 'submit'].includes(stageKey)) {
        setBackendStages(prev => ({
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

      if (data.event === 'paper_matched') {
        setBackendMatchedPapers(prev => [...prev, {
          paperId: data.paperId || data.paper_id,
          paperTitle: data.paperTitle || data.paper_title,
          technique: data.technique,
          reason: data.reason,
          source: data.source || 'registry',
        }]);
      }

      if (data.event === 'experiment_start') {
        setBackendExperiments(prev => {
          const exists = prev.find(e => e.id === data.experimentId);
          if (exists) {
            return prev.map(e => e.id === data.experimentId
              ? { ...e, status: 'running', logs: [...e.logs, { message: `Starting: ${data.strategy}`, timestamp: data.timestamp }].slice(-5) }
              : e
            );
          }
          return [...prev, {
            id: data.experimentId, paperId: data.paperId, paperTitle: data.paperTitle,
            technique: data.technique, strategy: data.strategy, status: 'running',
            cvScore: null, std: null, model: null, featuresUsed: null,
            logs: [{ message: `Starting: ${data.strategy}`, timestamp: data.timestamp }],
          }];
        });
      }

      if (data.event === 'experiment_log') {
        setBackendExperiments(prev => prev.map(exp =>
          exp.id === data.experimentId
            ? { ...exp, logs: [...exp.logs, { message: data.message, timestamp: data.timestamp }].slice(-5) }
            : exp
        ));
      }

      if (data.event === 'experiment_result') {
        setBackendExperiments(prev => prev.map(exp =>
          exp.id === data.experimentId
            ? { ...exp, status: 'done', cvScore: data.cvScore, std: data.std,
                model: data.model, featuresUsed: data.featuresUsed,
                logs: [...exp.logs, { message: `CV=${data.cvScore} (+/-${data.std})`, timestamp: data.timestamp }].slice(-5) }
            : exp
        ));
        setBackendLeaderboard(prev => {
          const updated = [...prev, {
            id: data.experimentId, paperId: data.paperId, technique: data.technique,
            cvScore: data.cvScore, std: data.std, model: data.model, featuresUsed: data.featuresUsed,
          }];
          return updated.sort((a, b) => b.cvScore - a.cvScore);
        });
      }

      if (data.event === 'best_selected') {
        setBackendBestExperiment({ id: data.experimentId, paperId: data.paperId,
          name: data.experimentName, cvScore: data.cvScore });
      }

      if (data.event === 'submission_ready') setBackendIsRunning(false);
      if (data.event === 'knowledge_graph_built') fetchKnowledgeGraph();
      if (data.status === 'completed' && data.stage === 'submit') setBackendIsRunning(false);
      if (data.status === 'error') setBackendIsRunning(false);
    };

    ws.onerror = () => {};
    ws.onclose = () => {};
    wsRef.current = ws;
    return () => ws.close();
  }, [useBackendMode, fetchKnowledgeGraph]);

  // ─── Start pipeline (routes to backend or browser mode) ───
  const startPipeline = async () => {
    if (!competition.trim() && !uploadedFiles) {
      setBackendError('Please enter a competition name or upload files.');
      return;
    }

    if (useBackendMode) {
      // Backend mode — existing WebSocket flow
      setBackendStages({
        download: { status: 'pending', logs: [] },
        explore: { status: 'pending', logs: [] },
        paper_search: { status: 'pending', logs: [] },
        experiment: { status: 'pending', logs: [] },
        submit: { status: 'pending', logs: [] },
      });
      setBackendMatchedPapers([]);
      setBackendExperiments([]);
      setBackendLeaderboard([]);
      setBackendBestExperiment(null);
      setBackendKnowledgeGraph(null);
      setBackendIsRunning(true);

      try {
        const response = await fetch(`${BACKEND_URL}/api/kaggle/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            competition: competition.trim(),
            apiToken: apiToken.trim(),
            llmProvider: localStorage.getItem('rg_llm_provider') || '',
            llmModel: localStorage.getItem('rg_llm_model') || '',
          }),
        });
        const data = await response.json();
        setSessionId(data.sessionId);
        setBackendError(null);
      } catch (err) {
        setBackendError('Could not reach backend. Falling back to browser mode may help.');
        setBackendOnline(false);
        setBackendIsRunning(false);
      }
    } else {
      // Browser mode — Pyodide
      pyodide.startPipeline({
        competition: competition.trim(),
        apiToken: apiToken.trim(),
        uploadedFiles: uploadedFiles || undefined,
        llmProvider: localStorage.getItem('rg_llm_provider') || '',
        llmModel: localStorage.getItem('rg_llm_model') || '',
        userApiKey: localStorage.getItem('rg_llm_api_key') || '',
      });
    }
  };

  // ─── Handle file upload ──────────────────────────────────
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setUploadedFiles(files);
      pyodide.setNeedsFileUpload(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      setUploadedFiles(files);
      pyodide.setNeedsFileUpload(false);
    }
  };

  // ─── Download submission ─────────────────────────────────
  const downloadSubmission = async () => {
    if (useBackendMode) {
      if (!competition) return;
      try {
        const response = await fetch(`${BACKEND_URL}/api/kaggle/submission/${competition}`);
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
    } else {
      pyodide.downloadSubmission();
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-neutral-400" />;
      case 'running': return <Loader2 className="w-4 h-4 text-neutral-600 animate-spin" />;
      case 'completed': return <Check className="w-4 h-4 text-neutral-700" />;
      case 'done': return <Check className="w-4 h-4 text-neutral-700" />;
      case 'error': return <X className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-neutral-400" />;
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

  const getRankLabel = (idx) => {
    if (idx === 0) return '1st';
    if (idx === 1) return '2nd';
    if (idx === 2) return '3rd';
    return `#${idx + 1}`;
  };

  // ──────────────── Render ────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-neutral-700" />
          <h2 className="font-mono text-lg font-bold uppercase tracking-widest text-neutral-900">
            Kaggle Agent Lab
          </h2>
        </div>
        <p className="text-sm text-neutral-500 font-light">
          Paper-driven AI agents -- Search papers, match techniques, run experiments, build knowledge graph
        </p>
      </div>

      {/* Mode indicator */}
      {useBackendMode ? (
        <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
          <Monitor className="w-3.5 h-3.5" />
          <span>Connected to backend server</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono">
          <Brain className="w-3.5 h-3.5" />
          <span>
            {pyodide.pyodideState === PYODIDE_STATES.READY
              ? 'Running in browser (Python via WebAssembly)'
              : pyodide.pyodideState === PYODIDE_STATES.LOADING
              ? 'Loading ML environment...'
              : 'Browser mode — ML runs locally in your browser'}
          </span>
        </div>
      )}

      {/* Pyodide loading progress */}
      {!useBackendMode && pyodide.pyodideState === PYODIDE_STATES.LOADING && (
        <div className="flex items-center gap-3 border border-blue-200 bg-blue-50 p-4 rounded-lg">
          <Loader2 className="w-5 h-5 text-blue-600 animate-spin flex-shrink-0" />
          <div>
            <div className="text-sm font-medium text-blue-800">Loading Python ML Environment</div>
            <div className="text-xs text-blue-600 mt-0.5">
              {pyodide.loadProgress || 'Downloading scikit-learn, pandas, numpy (~40MB, cached after first load)...'}
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Control Panel */}
      <div className="border border-neutral-200 bg-white p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-400">
              Competition Name
            </label>
            <Input
              type="text"
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
              placeholder="e.g., titanic"
              disabled={isRunning}
            />
            <span className="text-[11px] text-neutral-400">Enter the competition slug from Kaggle</span>
          </div>
          <div className="space-y-1.5">
            <label className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-400">
              Kaggle API Token
            </label>
            <Input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="KGAT_... or username:key"
              disabled={isRunning}
            />
            <span className="text-[11px] text-neutral-400">
              From kaggle.com/settings &mdash; needed to auto-download data
            </span>
          </div>
        </div>

        {/* File upload area — shown in browser mode */}
        {!useBackendMode && (
          <div
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
              uploadedFiles ? 'border-green-300 bg-green-50' :
              pyodide.needsFileUpload ? 'border-amber-300 bg-amber-50' :
              'border-neutral-200 bg-neutral-50 hover:border-neutral-300'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.zip"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={isRunning}
            />
            {uploadedFiles ? (
              <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                <Check className="w-4 h-4" />
                <span>{uploadedFiles.map(f => f.name).join(', ')}</span>
                <button
                  onClick={() => setUploadedFiles(null)}
                  className="ml-2 text-green-500 hover:text-green-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isRunning}
                className="w-full"
              >
                <div className="flex flex-col items-center gap-1.5">
                  <Upload className="w-5 h-5 text-neutral-400" />
                  <span className="text-sm text-neutral-500">
                    {pyodide.needsFileUpload
                      ? 'Download failed — drop train.csv + test.csv here (or a .zip)'
                      : 'Or upload files directly: drop train.csv + test.csv (or .zip)'}
                  </span>
                  <span className="text-[10px] text-neutral-400">
                    No API token? Download from Kaggle manually and upload here
                  </span>
                </div>
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            variant="default"
            onClick={startPipeline}
            disabled={isRunning || (!competition.trim() && !uploadedFiles)}
          >
            {isRunning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Agents Running...
              </>
            ) : (
              <>
                <Rocket className="w-4 h-4" />
                Launch Agents
              </>
            )}
          </Button>
          {bestExperiment && (
            <Button variant="outline" onClick={downloadSubmission}>
              <Download className="w-4 h-4" />
              Download Submission
            </Button>
          )}
        </div>
        {sessionId && (
          <div className="font-mono text-[10px] text-neutral-400">
            Session: {sessionId}
          </div>
        )}
      </div>

      {/* Pipeline Progress */}
      <div className="flex items-center justify-center gap-0 p-4 border border-neutral-200 bg-white">
        {PIPELINE_STEPS.map((step, idx) => {
          const stageStatus = stages[step.key]?.status || 'pending';
          return (
            <React.Fragment key={step.key}>
              <div className="flex flex-col items-center gap-1.5">
                <div className={`w-8 h-8 flex items-center justify-center border ${
                  stageStatus === 'completed' || stageStatus === 'done'
                    ? 'bg-neutral-900 border-neutral-900 text-white'
                    : stageStatus === 'running'
                    ? 'bg-white border-neutral-900 text-neutral-900'
                    : stageStatus === 'error'
                    ? 'bg-white border-red-400 text-red-500'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-400'
                }`}>
                  {getStatusIcon(stageStatus)}
                </div>
                <span className={`font-mono text-[10px] uppercase tracking-wider ${
                  stageStatus === 'completed' || stageStatus === 'done' || stageStatus === 'running'
                    ? 'text-neutral-700'
                    : 'text-neutral-400'
                }`}>
                  {step.label}
                </span>
              </div>
              {idx < PIPELINE_STEPS.length - 1 && (
                <div className={`w-10 h-px mx-1.5 mt-[-20px] ${
                  stageStatus === 'completed' || stageStatus === 'done' ? 'bg-neutral-900' : 'bg-neutral-200'
                }`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Paper Discovery Panel */}
      {matchedPapers.length > 0 && (
        <FadeIn>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-neutral-500" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-400">
                Paper Discovery -- {matchedPapers.length} Techniques Matched
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {matchedPapers.map((paper, idx) => {
                const info = getPaperInfo(paper.paperId);
                const isAI = paper.source === 'ai';
                return (
                  <div
                    key={idx}
                    className="border border-neutral-200 bg-white p-4 space-y-2"
                    style={{ borderLeftWidth: 3, borderLeftColor: isAI ? '#8b5cf6' : info.color }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <span className="font-mono text-sm font-bold text-neutral-800 block">
                          {paper.technique}
                        </span>
                        <span className="font-mono text-[10px] text-neutral-400 block">
                          {paper.paperId}
                        </span>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {isAI && (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={{ background: '#8b5cf620', color: '#8b5cf6', borderColor: '#8b5cf640' }}
                          >
                            AI
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className="text-[10px]"
                          style={{ background: info.color + '20', color: info.color, borderColor: info.color + '40' }}
                        >
                          {info.tag}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-500 font-light leading-relaxed">
                      {paper.reason}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </FadeIn>
      )}

      {/* Agent Cards Grid (dynamic) */}
      {experiments.length > 0 && (
        <FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {experiments.map(exp => {
              const info = getPaperInfo(exp.paperId);
              const isWinner = bestExperiment && bestExperiment.id === exp.id;
              return (
                <div
                  key={exp.id}
                  className={`border bg-white p-4 space-y-3 ${
                    isWinner
                      ? 'border-neutral-900 ring-1 ring-neutral-900'
                      : 'border-neutral-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <h3 className="font-mono text-sm font-bold text-neutral-800 truncate">
                        {exp.technique}
                      </h3>
                      <span className="text-xs text-neutral-500 font-light block truncate">
                        {exp.strategy}
                      </span>
                    </div>
                    <Badge
                      variant={
                        exp.status === 'done' ? 'default' :
                        exp.status === 'running' ? 'secondary' :
                        'outline'
                      }
                      className="text-[10px] shrink-0"
                    >
                      {exp.status === 'pending' ? 'Waiting' :
                       exp.status === 'running' ? 'Running' :
                       exp.status === 'done' ? 'Done' : exp.status}
                    </Badge>
                  </div>

                  <div className="font-mono text-[10px] text-neutral-400">
                    Inspired by: <strong className="text-neutral-600">{exp.paperId}</strong>
                  </div>

                  {exp.cvScore !== null && (
                    <div className="border border-neutral-100 p-3 text-center space-y-0.5">
                      <div className="font-mono text-xl font-bold text-neutral-900">
                        {exp.cvScore.toFixed(4)}
                      </div>
                      <div className="font-mono text-[10px] text-neutral-400">
                        CV Score (+/-{exp.std?.toFixed(3)})
                      </div>
                      <div className="font-mono text-[10px] text-neutral-400">
                        {exp.model} -- {exp.featuresUsed} features
                      </div>
                    </div>
                  )}

                  {exp.logs.length > 0 && (
                    <div className="space-y-1 border-t border-neutral-100 pt-2">
                      {exp.logs.map((log, idx) => (
                        <div key={idx} className="flex gap-2 text-[11px]">
                          <span className="font-mono text-neutral-300 shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className="text-neutral-500 truncate">{log.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </FadeIn>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <FadeIn>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-neutral-500" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-400">
                Leaderboard
              </h3>
            </div>
            <div className="border border-neutral-200 bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50">
                    <th className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400 text-left px-4 py-2.5">Rank</th>
                    <th className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400 text-left px-4 py-2.5">Paper</th>
                    <th className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400 text-left px-4 py-2.5">Technique</th>
                    <th className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400 text-right px-4 py-2.5">CV Score</th>
                    <th className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400 text-right px-4 py-2.5">Std</th>
                    <th className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400 text-right px-4 py-2.5">Features</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {leaderboard.map((entry, idx) => (
                    <tr
                      key={entry.id}
                      className={
                        bestExperiment && bestExperiment.id === entry.id
                          ? 'bg-neutral-50'
                          : ''
                      }
                    >
                      <td className="px-4 py-2.5 font-mono text-xs font-bold text-neutral-600">
                        {getRankLabel(idx)}
                      </td>
                      <td className="px-4 py-2.5">
                        <code className="font-mono text-xs text-neutral-600 bg-neutral-50 border border-neutral-200 px-1.5 py-0.5">
                          {entry.paperId}
                        </code>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-neutral-700">{entry.technique}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm font-bold text-neutral-900">
                        {entry.cvScore.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-neutral-500">
                        {entry.std.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-neutral-500">
                        {entry.featuresUsed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Winner Banner */}
      {bestExperiment && (
        <FadeIn>
          <div className="border border-neutral-900 bg-neutral-900 text-white p-5 flex items-center gap-4">
            <Trophy className="w-8 h-8 text-white shrink-0" />
            <div className="flex-1 space-y-0.5">
              <div className="font-mono text-sm font-bold uppercase tracking-wider">
                Winner: {bestExperiment.name}
              </div>
              <div className="font-mono text-xs text-neutral-400">
                Paper: {bestExperiment.paperId}
              </div>
              <div className="font-mono text-xs text-neutral-400">
                CV Score: {bestExperiment.cvScore.toFixed(4)}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadSubmission}
              className="border-neutral-600 text-white hover:bg-neutral-800"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </Button>
          </div>
        </FadeIn>
      )}

      {/* Knowledge Graph */}
      {knowledgeGraph && (
        <FadeIn>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-neutral-500" />
              <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-400">
                Knowledge Graph
              </h3>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-neutral-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-blue-500 inline-block" /> Paper
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-purple-500 inline-block" /> Technique
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-emerald-500 inline-block" /> Proven
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-red-500 inline-block" /> Unproven
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-amber-500 inline-block" /> Winner
              </span>
            </div>
            <div className="font-mono text-[10px] text-neutral-400">
              {knowledgeGraph.nodes.length} nodes -- {knowledgeGraph.edges.length} edges -- Baseline: {knowledgeGraph.baseline_score} -- Best: {knowledgeGraph.best_score}
            </div>
            <div className="border border-neutral-200 bg-white overflow-hidden">
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
                backgroundColor="#fafafa"
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
        </FadeIn>
      )}

      {/* Pipeline Logs */}
      {(stages.download.logs.length > 0 || stages.explore.logs.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-neutral-500" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-400">
              Pipeline Logs
            </h3>
          </div>
          <div className="border border-neutral-200 bg-white divide-y divide-neutral-100">
            {['download', 'explore'].map(stageKey => (
              stages[stageKey].logs.length > 0 && (
                <div key={stageKey} className="p-4 space-y-2">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                    {stageKey === 'download' ? 'Download' : 'Explore'}
                  </span>
                  <div className="space-y-1">
                    {stages[stageKey].logs.slice(-8).map((log, idx) => (
                      <div key={idx} className="flex gap-2 text-[11px]">
                        <span className="font-mono text-neutral-300 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-neutral-500">{log.message}</span>
                      </div>
                    ))}
                  </div>
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
