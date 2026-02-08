// Polymarket Gamma API integration
const GAMMA_API = 'https://gamma-api.polymarket.com';
const POLYMARKET_BASE = 'https://polymarket.com/event';

// Science/AI/tech related keywords to filter interesting markets
const SCIENCE_KEYWORDS = [
  'ai', 'artificial intelligence', 'gpt', 'openai', 'google', 'deepmind',
  'climate', 'nasa', 'space', 'mars', 'moon', 'quantum', 'fusion',
  'vaccine', 'fda', 'drug', 'disease', 'pandemic', 'virus',
  'nobel', 'research', 'study', 'science', 'technology', 'tech',
  'brain', 'neuralink', 'gene', 'crispr', 'protein',
  'agi', 'model', 'llm', 'chatgpt', 'claude', 'gemini', 'anthropic',
  'bitcoin', 'ethereum', 'crypto', 'blockchain',
  'nuclear', 'energy', 'solar', 'battery',
  'self-driving', 'autonomous', 'robot',
];

function matchesScience(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return SCIENCE_KEYWORDS.some(kw => lower.includes(kw));
}

export async function fetchPolymarketEvents({ limit = 20, scienceOnly = false } = {}) {
  try {
    // Fetch more than needed so we can filter
    const fetchLimit = scienceOnly ? 200 : limit;
    const directUrl = `${GAMMA_API}/events?closed=false&limit=${fetchLimit}&order=liquidityNum&ascending=false`;

    let events;
    try {
      // Try direct fetch first
      const res = await fetch(directUrl);
      if (!res.ok) throw new Error(`${res.status}`);
      events = await res.json();
    } catch {
      // CORS fallback via proxy
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;
      const res = await fetch(proxyUrl);
      if (!res.ok) throw new Error(`Proxy ${res.status}`);
      events = await res.json();
    }

    let filtered = events;
    if (scienceOnly) {
      filtered = events.filter(e =>
        matchesScience(e.title) || matchesScience(e.description)
      );
    }

    return filtered.slice(0, limit).map(event => ({
      id: `poly_${event.id}`,
      polymarketId: event.id,
      slug: event.slug,
      title: event.title,
      description: event.description,
      question: event.markets?.[0]?.question || event.title,
      outcomes: event.markets?.[0]?.outcomes || ['Yes', 'No'],
      outcomePrices: (event.markets?.[0]?.outcomePrices || ['0.5', '0.5']).map(Number),
      liquidity: event.liquidity || 0,
      volume: event.volume || 0,
      endDate: event.endDate,
      active: event.active,
      polymarketUrl: `${POLYMARKET_BASE}/${event.slug}`,
      bestBid: event.markets?.[0]?.bestBid || 0,
      bestAsk: event.markets?.[0]?.bestAsk || 0,
      source: 'polymarket',
    }));
  } catch (err) {
    console.error('Polymarket fetch failed:', err);
    return [];
  }
}

export function getPolymarketUrl(slug) {
  return `${POLYMARKET_BASE}/${slug}`;
}
