// Vercel serverless function — proxies Polymarket API to avoid CORS
// Dev-time proxy used by the frontend local server. Returns a uniform
// response shape: { items, total, page, limit, tags } to match production.
export default async function handler(req, res) {
  const limit = Math.min(parseInt(req.query.limit) || 30, 100);
  const tag = req.query.tag || '';
  const search = req.query.search || '';
  const closed = typeof req.query.closed !== 'undefined' ? req.query.closed : 'false';
  const active = typeof req.query.active !== 'undefined' ? req.query.active : 'true';
  const order = req.query.order || 'volume24hr';
  const ascending = req.query.ascending === 'true' ? 'true' : 'false';
  const page = Math.max(parseInt(req.query.page) || 1, 1);

  const fetchLimit = Math.min(200, limit * page);
  const params = new URLSearchParams({ closed: String(closed), active: String(active), limit: String(fetchLimit), order, ascending });
  if (tag) params.set('tag', tag);

  const url = `https://gamma-api.polymarket.com/events?${params.toString()}`;

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'TheRepublic/1.0' } });
    if (!response.ok) return res.status(response.status).json({ error: `Polymarket API returned ${response.status}` });
    let data = await response.json();
    if (!Array.isArray(data)) data = [];

    // server-side text search filter
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(event => {
        const haystack = [event.title, event.description, ...(event.markets || []).map(m => m.question)].join(' ').toLowerCase();
        return q.split(/\s+/).every(word => haystack.includes(word));
      });
    }

    const total = data.length;
    const offset = (page - 1) * limit;
    const items = data.slice(offset, offset + limit);

    const tagSet = new Set();
    for (const ev of data) {
      if (Array.isArray(ev.tags)) for (const t of ev.tags) if (t && (t.label || t)) tagSet.add(t.label || t);
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ items, total, page, limit, tags: Array.from(tagSet).slice(0, 50) });
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Polymarket API', detail: err.message });
  }
}
