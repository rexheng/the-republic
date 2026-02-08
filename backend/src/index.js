require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const http = require('http');

// Republic services
const KnowledgeGraph = require('../services/kg');
const AgentGateway = require('../services/agent-gateway');
const DataOracle = require('../services/data-oracle');
const Forensics = require('../services/forensics');
const TRiSM = require('../services/trism');
const Paper2AgentService = require('../services/paper2agent');
const Blockchain = require('../services/blockchain');
const SwarmEngine = require('../services/swarm');
const RepublicEngine = require('../services/republic-engine');

// Route factories
const kgRoutes = require('./routes/kg');
const agentRoutes = require('./routes/agents');
const oracleRoutes = require('./routes/oracle');
const forensicsRoutes = require('./routes/forensics');
const trismRoutes = require('./routes/trism');
const paper2agentRoutes = require('./routes/paper2agent');
const blockchainRoutes = require('./routes/blockchain');
const swarmRoutes = require('./routes/swarm');
const republicRoutes = require('./routes/republic');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for real-time logs
const wss = new WebSocket.Server({ server });

// ——— Instantiate Republic services ———
const kg = new KnowledgeGraph();
const agentGateway = new AgentGateway({ kg });
const oracle = new DataOracle();
const forensics = new Forensics({ kg });
const trism = new TRiSM({ kg });
const paper2agent = new Paper2AgentService({ kg, agentGateway, forensics });
const blockchain = new Blockchain();
const swarm = new SwarmEngine({ kg, agentGateway, dataOracle: oracle, forensics, paper2agent });
const republic = new RepublicEngine({ kg, agentGateway, dataOracle: oracle, forensics, trism, wss });

// Wire TRiSM into AgentGateway as post-response hook
agentGateway.setTRiSMHook(async (agentId, content, context) => {
  return trism.evaluateResponse(agentId, content, context);
});

// ——— Mount Republic routes ———
app.use('/api/kg', kgRoutes(kg));
app.use('/api/agents', agentRoutes(agentGateway));
app.use('/api/oracle', oracleRoutes(oracle, kg));
app.use('/api/forensics', forensicsRoutes(forensics));
app.use('/api/trism', trismRoutes(trism));
app.use('/api/papers', paper2agentRoutes(paper2agent));
app.use('/api/blockchain', blockchainRoutes(blockchain));
app.use('/api/swarm', swarmRoutes(swarm, wss));
app.use('/api/republic', republicRoutes(republic, wss));

// ——— Polymarket proxy (avoids CORS in browser) ———
app.get('/api/polymarket/events', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const url = `https://gamma-api.polymarket.com/events?closed=false&active=true&limit=${limit}&order=volume24hr&ascending=false`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Gamma API ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Polymarket proxy error:', err.message);
    res.status(502).json({ error: 'Failed to fetch from Polymarket' });
  }
});

// ——— Existing Kaggle pipeline routes ———

const activeSessions = new Map();

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

      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let parsed = null;
        try { parsed = JSON.parse(trimmed); } catch { broadcastLog(sessionId, 'experiment', trimmed, 'running'); continue; }

        const event = parsed.event;
        if (event === 'pipeline_start') {
          broadcastLog(sessionId, 'experiment', `Starting paper-driven pipeline on ${parsed.competition}`, 'running', { event: 'pipeline_start', target: parsed.target, problemType: parsed.problem_type });
        } else if (event === 'paper_matched') {
          if (session) { session.matchedPapers = session.matchedPapers || []; session.matchedPapers.push({ paperId: parsed.paper_id, technique: parsed.technique }); }
          broadcastLog(sessionId, 'paper_search', `Matched: ${parsed.technique} (${parsed.paper_id})`, 'running', { event: 'paper_matched' });
        } else if (event === 'experiment_result') {
          if (session) { session.experimentResults = session.experimentResults || []; session.experimentResults.push({ id: parsed.id, technique: parsed.technique, cvScore: parsed.cv_score }); }
          broadcastLog(sessionId, 'experiment', `${parsed.technique}: CV=${parsed.cv_score}`, 'running', { event: 'experiment_result' });
        } else if (event === 'submission_ready') {
          broadcastLog(sessionId, 'experiment', `Submission ready: ${parsed.rows} predictions`, 'completed', { event: 'submission_ready' });
        } else {
          broadcastLog(sessionId, 'experiment', parsed.message || trimmed, 'running');
        }
      }
    });

    pythonProcess.stderr.on('data', (data) => { errorOutput += data.toString(); });

    pythonProcess.on('close', (code) => {
      if (lineBuffer.trim()) broadcastLog(sessionId, 'experiment', lineBuffer.trim(), 'running');
      if (code === 0) resolve({ success: true, output }); else reject({ success: false, error: errorOutput, code });
    });
  });
}

// Kaggle routes
app.post('/api/kaggle/start', async (req, res) => {
  const { competition, apiToken } = req.body;
  if (!competition) return res.status(400).json({ error: 'Competition name is required' });

  const sessionId = `session_${Date.now()}`;
  const dataDir = path.join(__dirname, '..', 'data', competition);
  const submissionsDir = path.join(__dirname, '..', 'submissions', competition);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(submissionsDir, { recursive: true });

  activeSessions.set(sessionId, { competition, status: 'running', startTime: new Date(), stages: {}, matchedPapers: [], experimentResults: [] });

  (async () => {
    try {
      const kaggleEnv = apiToken ? { KAGGLE_API_TOKEN: apiToken } : {};
      await runPythonScript('kaggle_downloader.py', [competition, apiToken || '', dataDir], sessionId, 'download', kaggleEnv);
      await runPythonScript('data_analyzer.py', [dataDir, competition], sessionId, 'explore');
      await runExperimentRunner([dataDir, submissionsDir, competition], sessionId, kaggleEnv);
      activeSessions.get(sessionId).status = 'completed';
    } catch (error) {
      activeSessions.get(sessionId).status = 'error';
      broadcastLog(sessionId, error.stage || 'unknown', `Error: ${error.error || error.message}`, 'error');
    }
  })();

  res.json({ sessionId, message: 'Pipeline started', competition });
});

app.get('/api/kaggle/status/:sessionId', (req, res) => {
  const session = activeSessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json(session);
});

app.get('/api/kaggle/sessions', (req, res) => {
  res.json(Array.from(activeSessions.entries()).map(([id, data]) => ({ id, ...data })));
});

app.get('/api/kaggle/submission/:competition', (req, res) => {
  const p = path.join(__dirname, '..', 'submissions', req.params.competition, 'submission.csv');
  if (fs.existsSync(p)) res.download(p); else res.status(404).json({ error: 'Not found' });
});

app.get('/api/kaggle/knowledge-graph/:competition', (req, res) => {
  const p = path.join(__dirname, '..', 'data', req.params.competition, 'knowledge_graph.json');
  if (fs.existsSync(p)) { try { res.json(JSON.parse(fs.readFileSync(p, 'utf8'))); } catch { res.status(500).json({ error: 'Parse error' }); } }
  else res.status(404).json({ error: 'Not found' });
});

// Republic health
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    republic: {
      kg: kg.healthCheck(),
      agents: agentGateway.healthCheck(),
      oracle: oracle.healthCheck(),
      forensics: forensics.healthCheck(),
      trism: trism.healthCheck(),
      blockchain: blockchain.healthCheck(),
    },
  });
});

// WebSocket
wss.on('connection', (ws) => {
  console.log('Client connected to WebSocket');
  ws.on('close', () => console.log('Client disconnected'));
});

// Start server
server.listen(PORT, () => {
  console.log(`The Republic backend running on http://localhost:${PORT}`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
  console.log(`KG loaded: ${kg.getStats().paperCount} papers, ${kg.getStats().relationCount} relations`);
});
