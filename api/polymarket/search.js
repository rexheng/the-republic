// Serverless endpoint: /api/polymarket/search
// Implements a lightweight search over Polymarket events/markets using Gamma REST
// Supports: q/search, tag, series, active/closed, page, limit, and `all=true` (bounded)
const MAX_FETCH_LIMIT = 500;

async function fetchEventsOnce(params) {
  const url = `https://gamma-api.polymarket.com/events?${params.toString()}`;
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TheRepublic/1.0' } });
  if (!res.ok) throw new Error(`Gamma API ${res.status}`);
  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

export default async function handler(req, res) {
  const q = req.query.q || req.query.search || '';
  const tag = req.query.tag || '';
  const series = req.query.series || '';
  const closed = typeof req.query.closed !== 'undefined' ? req.query.closed : 'false';
  const active = typeof req.query.active !== 'undefined' ? req.query.active : 'true';
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(parseInt(req.query.limit) || 30, 200);
  const all = req.query.all === 'true';

  try {
    const params = new URLSearchParams({ closed: String(closed), active: String(active), order: 'volume24hr', ascending: 'false', limit: String(Math.min(MAX_FETCH_LIMIT, limit * page)) });
    if (tag) params.set('tag', tag);
    if (series) params.set('series', series);

    // If `all=true` requested, perform iterative fetches up to a safe cap
    let data = [];
    if (all) {
      let cursorLimit = 200;
      let accrued = [];
      // Simple loop: fetch in chunks until fewer than chunk returned or cap reached
      while (accrued.length < MAX_FETCH_LIMIT) {
        params.set('limit', String(cursorLimit));
        const chunk = await fetchEventsOnce(params);
        if (chunk.length === 0) break;
        accrued.push(...chunk);
        if (chunk.length < cursorLimit) break;
        // safety: avoid infinite loops
        if (accrued.length >= MAX_FETCH_LIMIT) break;
      }
      data = accrued;
    } else {
      data = await fetchEventsOnce(params);
      // emulate simple paging
      const offset = (page - 1) * limit;
      data = data.slice(offset, offset + limit);
    }

    // If query q present, filter by text across title/description/market.question
    if (q) {
      const ql = q.toLowerCase();
      data = data.filter(ev => {
        const hay = [ev.title, ev.description, ...(ev.markets || []).map(m => m.question)].join(' ').toLowerCase();
        return ql.split(/\s+/).every(w => hay.includes(w));
      });
    }

    // Build tag list
    const tagSet = new Set();
    for (const ev of data) if (Array.isArray(ev.tags)) for (const t of ev.tags) if (t && (t.label || t)) tagSet.add(t.label || t);

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=300');
    return res.status(200).json({ items: data, total: data.length, page, limit, tags: Array.from(tagSet).slice(0, 50) });
  } catch (err) {
    console.error('Polymarket search error:', err);
    return res.status(502).json({ error: 'Polymarket search failed', detail: err.message });
  }
}
