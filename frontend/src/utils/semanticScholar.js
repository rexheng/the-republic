import { SEMANTIC_SCHOLAR } from '../config';
import { getSeedGraphData } from './seedData';

// In-memory cache
const cache = new Map();

// Rate limiter: 1 request per second across all endpoints
let lastRequestTime = 0;
async function rateLimit() {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < SEMANTIC_SCHOLAR.RATE_LIMIT_MS) {
    await new Promise(r => setTimeout(r, SEMANTIC_SCHOLAR.RATE_LIMIT_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export function normalizeS2Paper(paper) {
  return {
    id: paper.paperId,
    paperId: paper.paperId,
    title: paper.title || 'Untitled',
    authors: (paper.authors || []).map(a => a.name || a),
    year: paper.year,
    citationCount: paper.citationCount || 0,
    influentialCitationCount: paper.influentialCitationCount || 0,
    abstract: paper.abstract || '',
    tldr: paper.tldr?.text || '',
    fieldsOfStudy: paper.fieldsOfStudy || [],
    doi: paper.externalIds?.DOI || null,
    arxivId: paper.externalIds?.ArXiv || null,
    source: 'semantic_scholar',
    references: (paper.references || []).filter(r => r.paperId).map(r => r.paperId),
    citations: (paper.citations || []).filter(c => c.paperId).map(c => c.paperId),
    val: Math.max(3, Math.log10((paper.citationCount || 0) + 1) * 3),
  };
}

// Authenticated fetch with API key + fallback chain
async function s2Fetch(url, options = {}) {
  await rateLimit();

  const headers = {
    'x-api-key': SEMANTIC_SCHOLAR.API_KEY,
    ...options.headers,
  };

  // Tier 1: Direct authenticated call
  try {
    const res = await fetch(url, { ...options, headers });
    if (res.status === 429) {
      // Rate limited — wait and retry once
      await new Promise(r => setTimeout(r, 2000));
      const retry = await fetch(url, { ...options, headers });
      if (retry.ok) return await retry.json();
      return null;
    }
    if (res.ok) return await res.json();
  } catch (e) {
    // Network/CORS error, try proxy
  }

  // Tier 2: allorigins proxy (no auth possible, but works for CORS)
  if (!options.method || options.method === 'GET') {
    try {
      const proxyUrl = `${SEMANTIC_SCHOLAR.PROXY_URL}${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl);
      if (res.ok) return await res.json();
    } catch (e) {
      // Proxy failed too
    }
  }

  return null;
}

// ─── Academic Graph API ──────────────────────────────────────────────────────

export async function searchPapers(query, limit = SEMANTIC_SCHOLAR.SEARCH_LIMIT) {
  const cacheKey = `search:${query}:${limit}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `${SEMANTIC_SCHOLAR.BASE_URL}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${SEMANTIC_SCHOLAR.SEARCH_FIELDS}`;
  const data = await s2Fetch(url);

  if (!data?.data) return [];

  const papers = data.data.map(normalizeS2Paper);
  cache.set(cacheKey, papers);
  return papers;
}

export async function getPaperDetails(paperId) {
  const cacheKey = `paper:${paperId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `${SEMANTIC_SCHOLAR.BASE_URL}/paper/${paperId}?fields=${SEMANTIC_SCHOLAR.FIELDS}`;
  const data = await s2Fetch(url);

  if (!data) return null;

  const paper = normalizeS2Paper(data);
  cache.set(cacheKey, paper);
  return paper;
}

// Batch paper details — up to 500 IDs per request
export async function batchPaperDetails(paperIds) {
  if (!paperIds?.length) return [];

  const uncached = [];
  const results = [];
  for (const id of paperIds) {
    const cached = cache.get(`paper:${id}`);
    if (cached) results.push(cached);
    else uncached.push(id);
  }

  if (uncached.length > 0) {
    // S2 batch endpoint: POST /paper/batch
    const batches = [];
    for (let i = 0; i < uncached.length; i += 500) {
      batches.push(uncached.slice(i, i + 500));
    }

    for (const batch of batches) {
      const url = `${SEMANTIC_SCHOLAR.BASE_URL}/paper/batch?fields=${SEMANTIC_SCHOLAR.SEARCH_FIELDS}`;
      const data = await s2Fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: batch }),
      });

      if (Array.isArray(data)) {
        for (const item of data) {
          if (item?.paperId) {
            const paper = normalizeS2Paper(item);
            cache.set(`paper:${item.paperId}`, paper);
            results.push(paper);
          }
        }
      }
    }
  }

  return results;
}

// ─── Recommendations API ─────────────────────────────────────────────────────

// Single-paper recommendations
export async function getRecommendations(paperId, limit = 10) {
  const cacheKey = `rec:${paperId}:${limit}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `${SEMANTIC_SCHOLAR.RECOMMENDATIONS_URL}/papers/forpaper/${paperId}?fields=${SEMANTIC_SCHOLAR.RECOMMENDATION_FIELDS}&limit=${limit}`;
  const data = await s2Fetch(url);

  if (!data?.recommendedPapers) return [];

  const papers = data.recommendedPapers.map(normalizeS2Paper);
  cache.set(cacheKey, papers);
  return papers;
}

// Multi-paper recommendations (based on a set of positive papers)
export async function getMultiRecommendations(positivePaperIds, negativePaperIds = [], limit = 20) {
  if (!positivePaperIds?.length) return [];

  const cacheKey = `multirec:${positivePaperIds.sort().join(',')}:${limit}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const url = `${SEMANTIC_SCHOLAR.RECOMMENDATIONS_URL}/papers/?fields=${SEMANTIC_SCHOLAR.RECOMMENDATION_FIELDS}&limit=${limit}`;
  const data = await s2Fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      positivePaperIds,
      negativePaperIds,
    }),
  });

  if (!data?.recommendedPapers) return [];

  const papers = data.recommendedPapers.map(normalizeS2Paper);
  cache.set(cacheKey, papers);
  return papers;
}

// ─── Utility: S2 ID Resolution ──────────────────────────────────────────────

// Try to find S2 paper ID from a paper object (may have DOI, title, arXiv ID)
export async function resolveS2PaperId(paper) {
  if (paper.paperId && !paper.paperId.startsWith('W') && !paper.paperId.startsWith('onchain')) {
    return paper.paperId; // Already an S2 ID
  }

  // Try DOI lookup
  if (paper.doi) {
    const details = await getPaperDetails(`DOI:${paper.doi}`);
    if (details) return details.paperId;
  }

  // Try arXiv lookup
  if (paper.arxivId) {
    const details = await getPaperDetails(`ARXIV:${paper.arxivId}`);
    if (details) return details.paperId;
  }

  // Try title search as last resort
  if (paper.title) {
    const results = await searchPapers(paper.title, 1);
    if (results.length > 0 && results[0].title.toLowerCase() === paper.title.toLowerCase()) {
      return results[0].paperId;
    }
  }

  return null;
}

// ─── Graph Building ──────────────────────────────────────────────────────────

export function buildGraphFromPapers(papers, existingGraph = null) {
  const nodeMap = new Map();
  const linkSet = new Set();

  // Carry over existing graph
  if (existingGraph) {
    existingGraph.nodes.forEach(n => nodeMap.set(n.id, n));
    existingGraph.links.forEach(l => {
      const key = `${typeof l.source === 'object' ? l.source.id : l.source}->${typeof l.target === 'object' ? l.target.id : l.target}`;
      linkSet.add(key);
    });
  }

  papers.forEach(paper => {
    if (!nodeMap.has(paper.id)) {
      nodeMap.set(paper.id, {
        ...paper,
        val: paper.val || Math.max(3, Math.log10((paper.citationCount || 0) + 1) * 3),
      });
    }

    // Add citation links
    (paper.references || []).forEach(refId => {
      const key = `${paper.id}->${refId}`;
      if (!linkSet.has(key)) {
        linkSet.add(key);
      }
    });

    (paper.citations || []).forEach(citId => {
      const key = `${citId}->${paper.id}`;
      if (!linkSet.has(key)) {
        linkSet.add(key);
      }
    });
  });

  const nodeIds = new Set(nodeMap.keys());
  const links = [];
  linkSet.forEach(key => {
    const [source, target] = key.split('->');
    if (nodeIds.has(source) && nodeIds.has(target)) {
      links.push({ source, target });
    }
  });

  return {
    nodes: Array.from(nodeMap.values()),
    links,
  };
}

export function mergeOnChainPapers(graphData, onChainPapers, userAddress) {
  const nodeMap = new Map();
  graphData.nodes.forEach(n => nodeMap.set(n.id, n));

  onChainPapers.forEach(paper => {
    const matchKey = paper.doi ?
      graphData.nodes.find(n => n.doi && n.doi === paper.doi)?.id : null;

    if (matchKey) {
      const existing = nodeMap.get(matchKey);
      nodeMap.set(matchKey, {
        ...existing,
        source: existing.source === 'seed' ? 'onchain' : existing.source,
        onChain: true,
        onChainId: paper.id,
        onChainStatus: paper.status,
        onChainAuthor: paper.author,
        ipfsHash: paper.ipfsHash,
        isUserPaper: paper.author?.toLowerCase() === userAddress?.toLowerCase(),
      });
    } else {
      const nodeId = `onchain_${paper.id}`;
      nodeMap.set(nodeId, {
        id: nodeId,
        paperId: nodeId,
        title: paper.doi || `On-chain Paper #${paper.id}`,
        authors: [paper.author?.slice(0, 10) + '...'],
        year: new Date(Number(paper.timestamp) * 1000).getFullYear(),
        citationCount: Number(paper.citationCount) || 0,
        abstract: '',
        fieldsOfStudy: [],
        doi: paper.doi,
        source: 'onchain',
        onChain: true,
        onChainId: paper.id,
        onChainStatus: paper.status,
        onChainAuthor: paper.author,
        ipfsHash: paper.ipfsHash,
        isUserPaper: paper.author?.toLowerCase() === userAddress?.toLowerCase(),
        val: 5,
      });
    }
  });

  return {
    nodes: Array.from(nodeMap.values()),
    links: graphData.links,
  };
}

export async function loadInitialGraph() {
  // Start with guaranteed seed data
  const seedGraph = getSeedGraphData();

  // Try to enhance with live data (non-blocking)
  try {
    const liveResults = await Promise.race([
      searchPapers('transformer language model', 10),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
    ]);

    if (liveResults.length > 0) {
      return buildGraphFromPapers(liveResults, seedGraph);
    }
  } catch (e) {
    // Live API unavailable, seed data is fine
  }

  return seedGraph;
}
