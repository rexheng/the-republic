// Vercel serverless function — proxies Polymarket API to avoid CORS
export default async function handler(req, res) {
  const limit = parseInt(req.query.limit) || 30;
  const tag = req.query.tag || '';
  const search = req.query.search || '';

  const params = new URLSearchParams({
    closed: 'false',
    active: 'true',
    limit: String(limit),
    order: 'volume24hr',
    ascending: 'false',
  });
  if (tag) params.set('tag', tag);

  const url = `https://gamma-api.polymarket.com/events?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'TheRepublic/1.0',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Polymarket API returned ${response.status}` });
    }

    let data = await response.json();
    if (!Array.isArray(data)) data = [];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(event => {
        const haystack = [event.title, event.description, ...(event.markets || []).map(m => m.question)].join(' ').toLowerCase();
        return q.split(/\s+/).every(word => haystack.includes(word));
      });
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to reach Polymarket API' });
  }
}
