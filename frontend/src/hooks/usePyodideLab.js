import { useState, useRef, useCallback } from 'react';
import JSZip from 'jszip';

/**
 * usePyodideLab — React hook for browser-native Kaggle Lab (Pyodide mode).
 *
 * Orchestrates: download → analyze → paper search → experiments → submission
 * All ML runs in a Web Worker via Pyodide (scikit-learn in WebAssembly).
 */

const PYODIDE_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ERROR: 'error',
};

export function usePyodideLab() {
  const workerRef = useRef(null);
  const [pyodideState, setPyodideState] = useState(PYODIDE_STATES.IDLE);
  const [loadProgress, setLoadProgress] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);

  // Pipeline state — same shape as KaggleLab.jsx expects
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
  const [submissionCsv, setSubmissionCsv] = useState(null);

  // Uploaded files fallback
  const [needsFileUpload, setNeedsFileUpload] = useState(false);

  const addLog = useCallback((stage, message) => {
    setStages(prev => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        logs: [...(prev[stage]?.logs || []), { message, timestamp: new Date().toISOString() }].slice(-50),
      },
    }));
  }, []);

  const setStageStatus = useCallback((stage, status) => {
    setStages(prev => ({
      ...prev,
      [stage]: { ...prev[stage], status },
    }));
  }, []);

  // ─── Initialize Pyodide Worker ───────────────────────────
  const initWorker = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (workerRef.current && pyodideState === PYODIDE_STATES.READY) {
        resolve();
        return;
      }

      setPyodideState(PYODIDE_STATES.LOADING);
      setLoadProgress('Starting Python runtime...');

      const worker = new Worker(
        new URL('../workers/pyodideWorker.js', import.meta.url),
        { type: 'classic' }
      );

      worker.onmessage = (e) => {
        const { type, message } = e.data;
        if (type === 'progress') {
          setLoadProgress(message);
        } else if (type === 'ready') {
          setPyodideState(PYODIDE_STATES.READY);
          setLoadProgress('');
          worker.onmessage = null; // Clear init handler so it doesn't interfere with workerCall
          resolve();
        } else if (type === 'error') {
          setPyodideState(PYODIDE_STATES.ERROR);
          setLoadProgress('');
          worker.onmessage = null;
          reject(new Error(message));
        }
      };

      worker.onerror = (err) => {
        setPyodideState(PYODIDE_STATES.ERROR);
        reject(err);
      };

      workerRef.current = worker;
      worker.postMessage({ type: 'init' });
    });
  }, [pyodideState]);

  // ─── Send message to worker and wait for response ────────
  const workerCall = useCallback((type, payload) => {
    return new Promise((resolve, reject) => {
      const worker = workerRef.current;
      if (!worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const handler = (e) => {
        const data = e.data;

        // Forward pipeline events to React state
        if (data.type === 'event') {
          handlePipelineEvent(data.event);
          return; // Don't resolve yet — wait for final result
        }

        // Final results
        if (data.type === 'analyzeResult') {
          worker.removeEventListener('message', handler);
          resolve(data.analysis);
        } else if (data.type === 'experimentsResult') {
          worker.removeEventListener('message', handler);
          resolve(data.result);
        } else if (data.type === 'error') {
          worker.removeEventListener('message', handler);
          reject(new Error(data.message));
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ type, ...payload });
    });
  }, []);

  // ─── Handle events emitted by Python via the worker ──────
  const handlePipelineEvent = useCallback((event) => {
    if (!event) return;

    // Paper matched
    if (event.event === 'paper_matched') {
      setMatchedPapers(prev => [...prev, {
        paperId: event.paper_id,
        paperTitle: event.paper_title,
        technique: event.technique,
        reason: event.reason,
        source: event.source || 'registry',
      }]);
    }

    // Experiment start
    if (event.event === 'experiment_start') {
      setExperiments(prev => {
        const exists = prev.find(e => e.id === event.id);
        if (exists) return prev;
        return [...prev, {
          id: event.id,
          paperId: event.paper_id,
          paperTitle: event.paper_title,
          technique: event.technique,
          strategy: event.strategy,
          status: 'running',
          cvScore: null, std: null, model: null, featuresUsed: null,
          logs: [{ message: `Starting: ${event.strategy}`, timestamp: new Date().toISOString() }],
        }];
      });
      addLog('experiment', `Agent ${event.id}: ${event.technique}`);
      setStageStatus('experiment', 'running');
    }

    // Experiment result
    if (event.event === 'experiment_result') {
      setExperiments(prev => prev.map(exp =>
        exp.id === event.id
          ? {
            ...exp, status: 'done', cvScore: event.cv_score, std: event.std,
            model: event.model, featuresUsed: event.features_used,
            logs: [...exp.logs, { message: `CV=${event.cv_score} (+/-${event.std})`, timestamp: new Date().toISOString() }].slice(-5),
          }
          : exp
      ));
      setLeaderboard(prev => {
        const updated = [...prev, {
          id: event.id, paperId: event.paper_id, technique: event.technique,
          cvScore: event.cv_score, std: event.std, model: event.model,
          featuresUsed: event.features_used,
        }];
        return updated.sort((a, b) => b.cvScore - a.cvScore);
      });
    }

    // Best selected
    if (event.event === 'best_selected') {
      setBestExperiment({
        id: event.id, paperId: event.paper_id,
        name: event.name, cvScore: event.cv_score,
      });
    }

    // Paper search events
    if (event.event === 'paper_search_start') {
      setStageStatus('paper_search', 'running');
      addLog('paper_search', event.message || 'Searching papers...');
    }
    if (event.event === 'paper_search_done') {
      setStageStatus('paper_search', 'completed');
      addLog('paper_search', `Matched ${event.matched} papers from registry`);
    }

    // Generic log
    if (event.event === 'log') {
      addLog('experiment', event.message);
    }
  }, [addLog, setStageStatus]);

  // ─── Download from Kaggle proxy ──────────────────────────
  const downloadData = useCallback(async (competition, apiToken) => {
    setStageStatus('download', 'running');
    addLog('download', 'Downloading competition data from Kaggle...');

    try {
      const res = await fetch('/api/kaggle/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competition, apiToken }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `Download failed (${res.status})`);
      }

      addLog('download', 'Extracting zip archive...');
      const zipBuffer = await res.arrayBuffer();
      const zip = await JSZip.loadAsync(zipBuffer);

      // Extract CSV files
      const files = {};
      for (const [path, file] of Object.entries(zip.files)) {
        if (!file.dir && path.endsWith('.csv')) {
          const name = path.split('/').pop();
          const content = await file.async('string');
          files[name] = content;
          addLog('download', `Extracted: ${name} (${(content.length / 1024).toFixed(0)} KB)`);
        }
      }

      if (Object.keys(files).length === 0) {
        throw new Error('No CSV files found in the downloaded archive');
      }

      setStageStatus('download', 'completed');
      addLog('download', `Downloaded ${Object.keys(files).length} file(s)`);
      return files;
    } catch (err) {
      addLog('download', `Download failed: ${err.message}`);
      setStageStatus('download', 'error');
      // Signal that user needs to upload files manually
      setNeedsFileUpload(true);
      throw err;
    }
  }, [addLog, setStageStatus]);

  // ─── Process manually uploaded files ─────────────────────
  const processUploadedFiles = useCallback(async (fileList) => {
    setStageStatus('download', 'running');
    addLog('download', 'Processing uploaded files...');

    const files = {};
    for (const file of fileList) {
      if (file.name.endsWith('.csv')) {
        const content = await file.text();
        files[file.name] = content;
        addLog('download', `Loaded: ${file.name} (${(content.length / 1024).toFixed(0)} KB)`);
      } else if (file.name.endsWith('.zip')) {
        addLog('download', `Extracting: ${file.name}...`);
        const zip = await JSZip.loadAsync(file);
        for (const [path, zipFile] of Object.entries(zip.files)) {
          if (!zipFile.dir && path.endsWith('.csv')) {
            const name = path.split('/').pop();
            const content = await zipFile.async('string');
            files[name] = content;
            addLog('download', `Extracted: ${name} (${(content.length / 1024).toFixed(0)} KB)`);
          }
        }
      }
    }

    if (Object.keys(files).length === 0) {
      throw new Error('No CSV files found. Please upload train.csv and test.csv (or a .zip containing them).');
    }

    setNeedsFileUpload(false);
    setStageStatus('download', 'completed');
    return files;
  }, [addLog, setStageStatus]);

  // ─── Full pipeline orchestrator ──────────────────────────
  const startPipeline = useCallback(async ({ competition, apiToken, uploadedFiles, llmProvider, llmModel, userApiKey }) => {
    setIsRunning(true);
    setError(null);
    setMatchedPapers([]);
    setExperiments([]);
    setLeaderboard([]);
    setBestExperiment(null);
    setKnowledgeGraph(null);
    setSubmissionCsv(null);
    setNeedsFileUpload(false);
    setStages({
      download: { status: 'pending', logs: [] },
      explore: { status: 'pending', logs: [] },
      paper_search: { status: 'pending', logs: [] },
      experiment: { status: 'pending', logs: [] },
      submit: { status: 'pending', logs: [] },
    });

    try {
      // Step 0: Init Pyodide if needed
      if (pyodideState !== PYODIDE_STATES.READY) {
        await initWorker();
      }

      // Step 1: Download data
      let files;
      if (uploadedFiles && uploadedFiles.length > 0) {
        files = await processUploadedFiles(uploadedFiles);
      } else {
        files = await downloadData(competition, apiToken);
      }

      // Step 2: Analyze data
      setStageStatus('explore', 'running');
      addLog('explore', 'Analyzing dataset with pandas...');

      const analysis = await workerCall('analyze', { files, competition });
      if (!analysis) throw new Error('Data analysis failed');

      setStageStatus('explore', 'completed');
      const meta = analysis._meta || {};
      addLog('explore', `Target: ${meta.target_column || '?'} | Features: ${meta.num_features || '?'}`);

      // Step 3: AI Paper Search (via serverless, non-blocking)
      setStageStatus('paper_search', 'running');
      addLog('paper_search', 'Querying AI for paper suggestions...');

      let aiSuggestions = null;
      try {
        const searchRes = await fetch('/api/kaggle/paper-search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            analysis,
            provider: llmProvider,
            model: llmModel,
            userApiKey,
          }),
        });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          aiSuggestions = searchData.suggestions;
          if (aiSuggestions?.length > 0) {
            addLog('paper_search', `AI suggested ${aiSuggestions.length} additional techniques`);
          } else {
            addLog('paper_search', 'AI paper search skipped (no API key or suggestions)');
          }
        }
      } catch (e) {
        addLog('paper_search', `AI search failed (non-critical): ${e.message}`);
      }

      // Step 4: Run experiments in Pyodide
      setStageStatus('experiment', 'running');
      addLog('experiment', 'Launching paper-driven ML agents...');

      const result = await workerCall('runExperiments', {
        competition,
        aiSuggestions: aiSuggestions || [],
      });

      if (!result) throw new Error('All experiments failed');

      // Step 5: Finalize
      setStageStatus('experiment', 'completed');
      setStageStatus('submit', 'completed');

      if (result.submission_csv) {
        setSubmissionCsv(result.submission_csv);
      }
      if (result.knowledge_graph) {
        setKnowledgeGraph(result.knowledge_graph);
      }

      addLog('submit', `Winner: ${result.winner} (CV=${result.cv_score})`);
    } catch (err) {
      setError(err.message);
      // Don't set isRunning to false if it's just a download failure that needs file upload
      if (!needsFileUpload) {
        setIsRunning(false);
      }
    } finally {
      // Only stop running if we're not waiting for file upload
      if (!needsFileUpload) {
        setIsRunning(false);
      }
    }
  }, [pyodideState, initWorker, downloadData, processUploadedFiles, workerCall, addLog, setStageStatus, needsFileUpload]);

  // ─── Download submission as file ─────────────────────────
  const downloadSubmission = useCallback(() => {
    if (!submissionCsv) return;
    const blob = new Blob([submissionCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'submission.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [submissionCsv]);

  return {
    // Pyodide state
    pyodideState,
    loadProgress,
    initWorker,

    // Pipeline state
    isRunning,
    error,
    stages,
    matchedPapers,
    experiments,
    leaderboard,
    bestExperiment,
    knowledgeGraph,
    submissionCsv,

    // File upload
    needsFileUpload,
    setNeedsFileUpload,
    processUploadedFiles,

    // Actions
    startPipeline,
    downloadSubmission,
  };
}

export { PYODIDE_STATES };
