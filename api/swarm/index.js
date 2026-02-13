// Vercel serverless function — Swarm Engine (KV-persistent polling-based status)

let kv = null;
try {
  const kvModule = await import('@vercel/kv');
  kv = kvModule.kv;
} catch {
  kv = null;
}

const KV_KEY = 'swarm:state';

const DEFAULT_STATE = {
  running: false,
  iteration: 0,
  stats: { papersAnalysed: 0, papersDiscovered: 0, triplesExtracted: 0, hypotheses: [], errors: 0 },
  log: [],
};

// In-memory fallback
let memState = { ...DEFAULT_STATE, stats: { ...DEFAULT_STATE.stats, hypotheses: [] }, log: [] };

async function getState() {
  if (!kv) return memState;
  const stored = await kv.get(KV_KEY);
  return stored || { ...DEFAULT_STATE };
}

async function setState(state) {
  if (!kv) { memState = state; return; }
  if (state.log && state.log.length > 100) {
    state.log = state.log.slice(-100);
  }
  await kv.set(KV_KEY, state);
}

export default async function handler(req, res) {
  const { action } = req.query;

  if (req.method === 'POST') {
    if (action === 'start') {
      const state = await getState();
      if (state.running) return res.status(200).json({ status: 'already_running', ...buildStatus(state) });
      state.running = true;
      state.log.push({ timestamp: new Date().toISOString(), message: 'Swarm started' });
      await setState(state);
      return res.status(200).json({ status: 'started', ...buildStatus(state) });
    }

    if (action === 'stop') {
      const state = await getState();
      state.running = false;
      state.log.push({ timestamp: new Date().toISOString(), message: 'Swarm stopping...' });
      await setState(state);
      return res.status(200).json({ status: 'stopping', ...buildStatus(state) });
    }
  }

  if (req.method === 'GET') {
    const state = await getState();
    switch (action) {
      case 'status':
        return res.status(200).json(buildStatus(state));
      case 'hypotheses':
        return res.status(200).json(state.stats.hypotheses);
      default:
        return res.status(200).json(buildStatus(state));
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function buildStatus(state) {
  return {
    running: state.running,
    iteration: state.iteration,
    queueLength: 0,
    analysedCount: 0,
    persistent: !!kv,
    stats: state.stats,
    recentLog: state.log.slice(-20),
  };
}
