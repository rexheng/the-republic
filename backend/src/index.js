const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for real-time logs
const wss = new WebSocket.Server({ server });

// Store active pipeline sessions
const activeSessions = new Map();

// Broadcast log to all connected clients
function broadcastLog(sessionId, stage, message, status = 'running', extra = {}) {
  const data = {
    sessionId,
    stage,
    message,
    status,
    timestamp: new Date().toISOString(),
    ...extra
  };

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// Run Python script with real-time output
function runPythonScript(scriptName, args, sessionId, stage, env = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'python', scriptName);
    const pythonProcess = spawn('python3', [scriptPath, ...args], {
      env: { ...process.env, ...env }
    });

    let output = '';
    let errorOutput = '';

    pythonProcess.stdout.on('data', (data) => {
      const message = data.toString();
      output += message;
      broadcastLog(sessionId, stage, message.trim(), 'running');
    });

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      broadcastLog(sessionId, stage, message.trim(), 'running');
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        broadcastLog(sessionId, stage, 'Completed successfully', 'completed');
        resolve({ success: true, output, stage });
      } else {
        broadcastLog(sessionId, stage, `Failed with code ${code}`, 'error');
        reject({ success: false, error: errorOutput, stage, code });
      }
    });
  });
}

// Run paper_experiment_runner.py with JSON-line parsing
function runExperimentRunner(args, sessionId, env = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '..', 'python', 'paper_experiment_runner.py');
    const pythonProcess = spawn('python3', [scriptPath, ...args], {
      env: { ...process.env, ...env }
    });

    let output = '';
    let errorOutput = '';
    let lineBuffer = '';

    const session = activeSessions.get(sessionId);

    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      lineBuffer += chunk;

      // Process complete lines
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop(); // keep incomplete line in buffer

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let parsed = null;
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {
          // Not JSON — forward as plain log
          broadcastLog(sessionId, 'experiment', trimmed, 'running');
          continue;
        }

        const event = parsed.event;

        if (event === 'pipeline_start') {
          broadcastLog(sessionId, 'experiment', `Starting paper-driven pipeline on ${parsed.competition}`, 'running', {
            event: 'pipeline_start',
            target: parsed.target,
            problemType: parsed.problem_type,
            trainRows: parsed.train_rows,
            testRows: parsed.test_rows
          });

        } else if (event === 'paper_search_start') {
          if (session) {
            session.stages.paper_search = 'running';
          }
          broadcastLog(sessionId, 'paper_search', parsed.message, 'running', {
            event: 'paper_search_start'
          });

        } else if (event === 'paper_matched') {
          if (session) {
            session.matchedPapers = session.matchedPapers || [];
            session.matchedPapers.push({
              paperId: parsed.paper_id,
              paperTitle: parsed.paper_title,
              technique: parsed.technique,
              reason: parsed.reason,
            });
          }
          broadcastLog(sessionId, 'paper_search', `Matched: ${parsed.technique} (${parsed.paper_id})`, 'running', {
            event: 'paper_matched',
            paperId: parsed.paper_id,
            paperTitle: parsed.paper_title,
            technique: parsed.technique,
            reason: parsed.reason,
          });

        } else if (event === 'paper_search_done') {
          if (session) {
            session.stages.paper_search = 'completed';
          }
          broadcastLog(sessionId, 'paper_search', `Found ${parsed.matched} relevant papers from ${parsed.total} in library`, 'completed', {
            event: 'paper_search_done',
            matched: parsed.matched,
            total: parsed.total,
          });

        } else if (event === 'experiment_start') {
          if (session) {
            session.experiments = session.experiments || [];
          }
          broadcastLog(sessionId, 'experiment', `Starting ${parsed.technique}...`, 'running', {
            event: 'experiment_start',
            experimentId: parsed.id,
            paperId: parsed.paper_id,
            paperTitle: parsed.paper_title,
            technique: parsed.technique,
            strategy: parsed.strategy,
          });

        } else if (event === 'log') {
          broadcastLog(sessionId, 'experiment', parsed.message, 'running', {
            event: 'experiment_log',
            experimentId: parsed.id,
            message: parsed.message
          });

        } else if (event === 'experiment_result') {
          const result = {
            id: parsed.id,
            paperId: parsed.paper_id,
            technique: parsed.technique,
            cvScore: parsed.cv_score,
            std: parsed.std,
            featuresUsed: parsed.features_used,
            model: parsed.model
          };
          if (session) {
            session.experimentResults = session.experimentResults || [];
            session.experimentResults.push(result);
          }
          broadcastLog(sessionId, 'experiment', `${parsed.technique}: CV=${parsed.cv_score} (+/-${parsed.std})`, 'running', {
            event: 'experiment_result',
            experimentId: parsed.id,
            paperId: parsed.paper_id,
            technique: parsed.technique,
            cvScore: parsed.cv_score,
            std: parsed.std,
            featuresUsed: parsed.features_used,
            model: parsed.model
          });

        } else if (event === 'experiment_error') {
          broadcastLog(sessionId, 'experiment', `Experiment ${parsed.id} (${parsed.paper_id}) failed: ${parsed.message}`, 'running', {
            event: 'experiment_error',
            experimentId: parsed.id,
            paperId: parsed.paper_id,
          });

        } else if (event === 'best_selected') {
          if (session) {
            session.bestExperiment = {
              id: parsed.id,
              paperId: parsed.paper_id,
              name: parsed.name,
              cvScore: parsed.cv_score
            };
          }
          broadcastLog(sessionId, 'experiment', `Winner: ${parsed.name} (${parsed.paper_id}, CV=${parsed.cv_score})`, 'running', {
            event: 'best_selected',
            experimentId: parsed.id,
            paperId: parsed.paper_id,
            experimentName: parsed.name,
            cvScore: parsed.cv_score
          });

        } else if (event === 'submission_ready') {
          broadcastLog(sessionId, 'experiment', `Submission ready: ${parsed.rows} predictions from ${parsed.winner_technique || parsed.winner}`, 'completed', {
            event: 'submission_ready',
            path: parsed.path,
            rows: parsed.rows,
            winner: parsed.winner,
            winnerTechnique: parsed.winner_technique,
            cvScore: parsed.cv_score
          });

        } else if (event === 'knowledge_graph_built') {
          if (session) {
            session.knowledgeGraphPath = parsed.path;
          }
          broadcastLog(sessionId, 'experiment', `Knowledge graph: ${parsed.nodes} nodes, ${parsed.edges} edges (${parsed.proven} proven, ${parsed.unproven} unproven)`, 'completed', {
            event: 'knowledge_graph_built',
            nodes: parsed.nodes,
            edges: parsed.edges,
            proven: parsed.proven,
            unproven: parsed.unproven,
          });

        } else if (event === 'error') {
          broadcastLog(sessionId, 'experiment', parsed.message, 'error', {
            event: 'experiment_error'
          });
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const message = data.toString();
      errorOutput += message;
      broadcastLog(sessionId, 'experiment', message.trim(), 'running');
    });

    pythonProcess.on('close', (code) => {
      // Process any remaining buffer
      if (lineBuffer.trim()) {
        broadcastLog(sessionId, 'experiment', lineBuffer.trim(), 'running');
      }
      if (code === 0) {
        resolve({ success: true, output, stage: 'experiment' });
      } else {
        reject({ success: false, error: errorOutput, stage: 'experiment', code });
      }
    });
  });
}

// API Routes

// Start Kaggle pipeline
app.post('/api/kaggle/start', async (req, res) => {
  const { competition, apiToken } = req.body;

  if (!competition) {
    return res.status(400).json({ error: 'Competition name is required' });
  }

  const sessionId = `session_${Date.now()}`;
  const dataDir = path.join(__dirname, '..', 'data', competition);
  const submissionsDir = path.join(__dirname, '..', 'submissions', competition);

  // Create directories
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(submissionsDir, { recursive: true });

  activeSessions.set(sessionId, {
    competition,
    status: 'running',
    startTime: new Date(),
    stages: {
      download: 'pending',
      explore: 'pending',
      paper_search: 'pending',
      experiment: 'pending',
      submit: 'pending'
    },
    matchedPapers: [],
    experimentResults: [],
    bestExperiment: null,
    knowledgeGraphPath: null
  });

  // Start pipeline asynchronously
  (async () => {
    try {
      // Stage 1: Download data
      broadcastLog(sessionId, 'download', 'Starting data download...', 'running');
      activeSessions.get(sessionId).stages.download = 'running';
      const kaggleEnv = apiToken ? { KAGGLE_API_TOKEN: apiToken } : {};
      await runPythonScript('kaggle_downloader.py', [competition, apiToken || '', dataDir], sessionId, 'download', kaggleEnv);
      activeSessions.get(sessionId).stages.download = 'completed';

      // Stage 2: Deep explore (analyze)
      broadcastLog(sessionId, 'explore', 'Starting deep data exploration...', 'running');
      activeSessions.get(sessionId).stages.explore = 'running';
      await runPythonScript('data_analyzer.py', [dataDir, competition], sessionId, 'explore');
      activeSessions.get(sessionId).stages.explore = 'completed';

      // Stage 3 + 4: Paper search + run experiments (handled by paper_experiment_runner.py)
      broadcastLog(sessionId, 'experiment', 'Launching paper-driven experiment pipeline...', 'running');
      activeSessions.get(sessionId).stages.experiment = 'running';
      await runExperimentRunner([dataDir, submissionsDir, competition], sessionId, kaggleEnv);
      activeSessions.get(sessionId).stages.paper_search = 'completed';
      activeSessions.get(sessionId).stages.experiment = 'completed';

      // Stage 5: Submit ready
      broadcastLog(sessionId, 'submit', 'Submission file generated by winning paper strategy', 'completed');
      activeSessions.get(sessionId).stages.submit = 'completed';
      activeSessions.get(sessionId).status = 'completed';

    } catch (error) {
      console.error('Pipeline error:', error);
      activeSessions.get(sessionId).status = 'error';
      broadcastLog(sessionId, error.stage || 'unknown', `Error: ${error.error || error.message}`, 'error');
    }
  })();

  res.json({
    sessionId,
    message: 'Pipeline started',
    competition
  });
});

// Get session status
app.get('/api/kaggle/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  res.json(session);
});

// List all sessions
app.get('/api/kaggle/sessions', (req, res) => {
  const sessions = Array.from(activeSessions.entries()).map(([id, data]) => ({
    id,
    ...data
  }));
  res.json(sessions);
});

// Download submission file
app.get('/api/kaggle/submission/:competition', (req, res) => {
  const { competition } = req.params;
  const submissionPath = path.join(__dirname, '..', 'submissions', competition, 'submission.csv');

  if (fs.existsSync(submissionPath)) {
    res.download(submissionPath);
  } else {
    res.status(404).json({ error: 'Submission file not found' });
  }
});

// Get knowledge graph for a competition
app.get('/api/kaggle/knowledge-graph/:competition', (req, res) => {
  const { competition } = req.params;
  const kgPath = path.join(__dirname, '..', 'data', competition, 'knowledge_graph.json');

  if (fs.existsSync(kgPath)) {
    try {
      const kg = JSON.parse(fs.readFileSync(kgPath, 'utf8'));
      res.json(kg);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse knowledge graph' });
    }
  } else {
    res.status(404).json({ error: 'Knowledge graph not found' });
  }
});

// WebSocket connection handler
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');

  ws.on('close', () => {
    console.log('Client disconnected from WebSocket');
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
