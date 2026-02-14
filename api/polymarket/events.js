// Vercel serverless function — proxies Polymarket API to avoid CORS
// Simple in-memory cache to reduce repeated large fetches in warm serverless envs
const CACHE_TTL = 30 * 1000; // 30 seconds
const cache = new Map(); // key -> { ts, data }

// Minimal keyword map for server-side field detection (kept small)
const FIELD_KEYWORDS = {
  'Computer Science': ['ai', 'algorithm', 'software', 'computing', 'neural', 'model', 'gpt', 'llm', 'transformer', 'crypto', 'blockchain'],
  'Economics': ['gdp', 'inflation', 'recession', 'market', 'trade', 'tariff', 'inflation', 'economy', 'stock', 'currency'],
  'Political Science': ['election', 'vote', 'poll', 'president', 'congress', 'senate', 'campaign', 'legislation'],
  'Medicine': ['fda', 'drug', 'vaccine', 'trial', 'disease', 'health', 'treatment', 'clinical', 'covid'],
  'Environmental Science': ['climate', 'carbon', 'emission', 'temperature', 'renewable', 'solar', 'wind', 'drought'],
};

function detectEventFields(event) {
  const text = [event.title, event.description, ...(event.markets || []).map(m => m.question)].join(' ').toLowerCase();
  const matched = [];
  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    let hits = 0;
    for (const k of keywords) {
      if (text.includes(k)) hits += 1;
    }
    if (hits > 0) matched.push({ field, hits });
  }
  return matched.sort((a, b) => b.hits - a.hits).map(m => m.field);
}

export default async function handler(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const tag = req.query.tag || '';       // e.g. "science", "politics"
  const search = req.query.search || ''; // free-text search
  const order = req.query.order || 'volume24hr';
  const ascending = req.query.ascending === 'true' ? 'true' : 'false';
  const page = Math.max(parseInt(req.query.page) || 1, 1);

  // Gamma REST may not support offset-based pagination. To emulate simple
  // page-based pagination, request up to `limit * page` items and slice.
  const fetchLimit = Math.min(200, limit * page);

  // Build the gamma API URL
  const params = new URLSearchParams({
    closed: 'false',
    active: 'true',
    limit: String(fetchLimit),
    order,
    ascending,
  });
  if (tag) params.set('tag', tag);

  const url = `https://gamma-api.polymarket.com/events?${params.toString()}`;

  // Check cache
  const cacheKey = url;
  const now = Date.now();
  if (cache.has(cacheKey)) {
    const entry = cache.get(cacheKey);
    if (now - entry.ts < CACHE_TTL) {
      // Use cached copy
      let data = entry.data;

      // Server-side search filter
      if (search) {
        const q = search.toLowerCase();
        data = data.filter(event => {
          const haystack = [
            event.title,
            event.description,
            ...(event.markets || []).map(m => m.question),
          ].join(' ').toLowerCase();
          return q.split(/\s+/).every(word => haystack.includes(word));
        });
      }

      // Add server-side fields if missing
      for (const ev of data) {
        if (!ev.fields) ev.fields = detectEventFields(ev);
      }

      const total = data.length;
      const offset = (page - 1) * limit;
      const items = data.slice(offset, offset + limit);
      const tagSet = new Set();
      for (const ev of data) {
        if (Array.isArray(ev.tags)) {
          for (const t of ev.tags) if (t && (t.label || t)) tagSet.add(t.label || t);
        }
      }
      return res.status(200).json({ items, total, page, limit, tags: Array.from(tagSet).slice(0, 50) });
    }
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TheRepublic/1.0',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Polymarket API returned ${response.status}`,
        detail: await response.text().catch(() => ''),
      });
    }

    let data = await response.json();

    // Ensure array
    if (!Array.isArray(data)) data = [];

    // Cache raw data for short TTL
    try {
      cache.set(cacheKey, { ts: now, data });
    } catch {}

    // Server-side search filter: match title/description/question
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(event => {
        const haystack = [
          event.title,
          event.description,
          ...(event.markets || []).map(m => m.question),
        ].join(' ').toLowerCase();
        return q.split(/\s+/).every(word => haystack.includes(word));
      });
    }

    // Add server-side fields detection
    for (const ev of data) {
      if (!ev.fields) ev.fields = detectEventFields(ev);
    }

    // Compute paging (simple page numbers)
    const total = data.length;
    const offset = (page - 1) * limit;
    const items = data.slice(offset, offset + limit);

    // Gather unique tags from the returned items for UI chips
    const tagSet = new Set();
    for (const ev of data) {
      if (Array.isArray(ev.tags)) {
        for (const t of ev.tags) {
          if (t && (t.label || t)) tagSet.add(t.label || t);
        }
      }
    }
    const tags = Array.from(tagSet).slice(0, 50);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ items, total, page, limit, tags });
  } catch (err) {
    console.error('Polymarket proxy error:', err);
    return res.status(502).json({ error: 'Failed to reach Polymarket API', detail: err.message });
  }
}
