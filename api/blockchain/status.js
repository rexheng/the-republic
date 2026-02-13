// Vercel serverless function — Blockchain status (dual-chain RPC reads)

async function getBlockNumber(rpcUrl) {
  try {
    const res = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return { connected: true, blockNumber: parseInt(data.result, 16) };
  } catch {
    return { connected: false, blockNumber: null };
  }
}

// Demo blockchain events
const DEMO_EVENTS = [
  { id: 'evt-1', chain: 'human', type: 'PaperSubmitted', data: { paperId: 1, author: '0x742d...4a3e' }, timestamp: new Date(Date.now() - 3600000).toISOString() },
  { id: 'evt-2', chain: 'human', type: 'ReviewSubmitted', data: { paperId: 1, reviewer: '0x8f3b...c2d1' }, timestamp: new Date(Date.now() - 2400000).toISOString() },
  { id: 'evt-3', chain: 'ai', type: 'AgentAnalysis', data: { agentId: 'iris', paperId: 'vaswani2017' }, timestamp: new Date(Date.now() - 1800000).toISOString() },
  { id: 'evt-4', chain: 'ai', type: 'AgentAnalysis', data: { agentId: 'atlas', paperId: 'vaswani2017' }, timestamp: new Date(Date.now() - 1200000).toISOString() },
  { id: 'evt-5', chain: 'human', type: 'MarketCreated', data: { marketId: 1, paperId: 'vaswani2017' }, timestamp: new Date(Date.now() - 600000).toISOString() },
  { id: 'evt-6', chain: 'ai', type: 'ForensicsScore', data: { paperId: 'vaswani2017', score: 87 }, timestamp: new Date(Date.now() - 300000).toISOString() },
];

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action } = req.query;

  if (action === 'events') {
    const limit = parseInt(req.query.limit) || 20;
    return res.status(200).json(DEMO_EVENTS.slice(-limit).reverse());
  }

  // Default: status
  const [humanResult, aiResult] = await Promise.all([
    getBlockNumber('https://coston2-api.flare.network/ext/C/rpc'),
    getBlockNumber(process.env.PLASMA_RPC || 'https://rpc-testnet.plasma.xyz'),
  ]);

  res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
  return res.status(200).json({
    humanChain: {
      name: 'Flare Testnet (Coston2)',
      chainId: 114,
      ...humanResult,
      role: 'Human verification, paper submissions, reviews',
    },
    aiChain: {
      name: 'Plasma Testnet',
      chainId: 9746,
      ...aiResult,
      role: 'AI agent transactions, autonomous operations',
    },
    bridge: { transferCount: 0, recentTransfers: [] },
    events: DEMO_EVENTS.slice(-10).reverse(),
  });
}
