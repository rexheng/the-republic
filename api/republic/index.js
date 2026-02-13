// Vercel serverless function — Republic Engine (KV-persistent polling-based status)

let kv = null;
try {
  const kvModule = await import('@vercel/kv');
  kv = kvModule.kv;
} catch {
  kv = null;
}

const KV_KEY = 'republic:state';

// Default state
const DEFAULT_STATE = {
  alive: false,
  epoch: 0,
  vitals: {
    born: null,
    epoch: 0,
    papersAnalysed: 0,
    papersDiscovered: 0,
    hypothesesGenerated: 0,
    triplesExtracted: 0,
    marketsCreated: 0,
    forensicsScans: 0,
    agentActions: 0,
  },
  hypotheses: [],
  judgements: [],
  alerts: [],
  markets: [],
  log: [],
};

// In-memory fallback when KV not available
let memState = { ...DEFAULT_STATE, vitals: { ...DEFAULT_STATE.vitals }, hypotheses: [], judgements: [], alerts: [], markets: [], log: [] };

async function getState() {
  if (!kv) return memState;
  const stored = await kv.get(KV_KEY);
  return stored || { ...DEFAULT_STATE };
}

async function setState(state) {
  if (!kv) { memState = state; return; }
  // Cap log to 100 entries to avoid KV size bloat
  if (state.log && state.log.length > 100) {
    state.log = state.log.slice(-100);
  }
  await kv.set(KV_KEY, state);
}

export default async function handler(req, res) {
  const { action } = req.query;

  if (req.method === 'POST') {
    if (action === 'awaken') {
      const state = await getState();
      state.alive = true;
      state.vitals.born = state.vitals.born || new Date().toISOString();
      state.log.push({ timestamp: new Date().toISOString(), message: 'The Republic awakens.' });
      await setState(state);
      return res.status(200).json({ status: 'awakening', ...buildStatus(state) });
    }

    if (action === 'sleep') {
      const state = await getState();
      state.alive = false;
      state.log.push({ timestamp: new Date().toISOString(), message: 'The Republic rests.' });
      await setState(state);
      return res.status(200).json({ status: 'sleeping', ...buildStatus(state) });
    }
  }

  if (req.method === 'GET') {
    const state = await getState();
    switch (action) {
      case 'status':
        return res.status(200).json(buildStatus(state));
      case 'hypotheses':
        return res.status(200).json(state.hypotheses);
      case 'judgements':
        return res.status(200).json(state.judgements);
      case 'alerts':
        return res.status(200).json(state.alerts);
      case 'markets':
        return res.status(200).json(state.markets);
      default:
        return res.status(200).json(buildStatus(state));
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

function buildStatus(state) {
  return {
    alive: state.alive,
    epoch: state.epoch,
    vitals: state.vitals,
    persistent: !!kv,
    queues: { philosophers: 0, warriors: 0, artisans: 0 },
    kg: { paperCount: 5, authorCount: 10, relationCount: 3 },
    markets: state.markets.length,
    hypotheses: state.hypotheses.length,
    judgements: state.judgements.length,
    alerts: state.alerts.length,
    recentLog: state.log.slice(-30),
    budget: {},
  };
}
