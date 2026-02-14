// Polymarket integration — uses same-origin Vercel serverless function
const POLYMARKET_BASE = "https://polymarket.com/event";
const GAMMA_API = "https://gamma-api.polymarket.com";

// Parse a JSON string field that might already be an array
function parseJsonField(raw, fallback = []) {
  if (!raw) return fallback;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

async function fetchEventsRaw(limit, { search = '', tag = '' } = {}) {
  // Always use same-origin proxy to avoid CORS and ensure dev/prod parity.
  const params = new URLSearchParams({ limit: String(limit) });
  if (search) params.set('search', search);
  if (tag) params.set('tag', tag);
  // Keep optional ordering & pagination; callers may add them to opts
  return fetch(`/api/polymarket/events?${params.toString()}`)
    .then(async (res) => {
      if (!res.ok) return { items: [], total: 0, page: 1, limit };
      const json = await res.json();
      // Support both legacy array responses and new { items } shape
      if (Array.isArray(json)) return { items: json.slice(0, limit), total: json.length, page: 1, limit };
      return {
        items: Array.isArray(json.items) ? json.items : [],
        total: typeof json.total === 'number' ? json.total : (Array.isArray(json.items) ? json.items.length : 0),
        page: typeof json.page === 'number' ? json.page : 1,
        limit: typeof json.limit === 'number' ? json.limit : limit,
        tags: Array.isArray(json.tags) ? json.tags : [],
      };
    })
    .catch(() => ({ items: [], total: 0, page: 1, limit }));
}

export async function fetchPolymarketEvents({ limit = 30, search = '', tag = '', order = 'volume24hr', page = 1 } = {}) {
  try {
    // Attach order & page to the proxy call
    const params = new URLSearchParams({ limit: String(limit), order, page: String(page) });
    if (search) params.set('search', search);
    if (tag) params.set('tag', tag);

    const res = await fetch(`/api/polymarket/events?${params.toString()}`);
    let payload = { items: [], total: 0, page, limit };
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) payload = { items: json.slice(0, limit), total: json.length, page, limit };
      else payload = {
        items: Array.isArray(json.items) ? json.items : [],
        total: typeof json.total === 'number' ? json.total : (Array.isArray(json.items) ? json.items.length : 0),
        page: typeof json.page === 'number' ? json.page : page,
        limit: typeof json.limit === 'number' ? json.limit : limit,
        tags: Array.isArray(json.tags) ? json.tags : [],
      };
    }

    const events = payload.items || [];
    if (events.length === 0) return { items: [], total: payload.total || 0, page: payload.page || page, limit: payload.limit || limit, tags: payload.tags || [] };

    const mapped = events.slice(0, limit).map((event) => {
      const market = event.markets?.[0];
      let outcomes = ["Yes", "No"];
      let outcomePrices = [0.5, 0.5];

      if (market) {
        outcomes = parseJsonField(market.outcomes, ["Yes", "No"]);
        const rawPrices = parseJsonField(market.outcomePrices, []);
        if (rawPrices.length > 0) {
          outcomePrices = rawPrices.map((p) => parseFloat(p) || 0.5);
        }
      }

      const yesPrice = outcomePrices[0] || 0.5;

      // Detect academic fields for this event
      // If server supplied `fields`, use that; otherwise compute locally
      const fields = event.fields || detectEventFields(event);

      return {
        id: `poly_${event.id}`,
        polymarketId: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        question: market?.question || event.title,
        outcomes,
        outcomePrices,
        liquidity: parseFloat(event.liquidity) || 0,
        volume: parseFloat(event.volume) || 0,
        volume24hr: event.volume24hr || 0,
        endDate: event.endDate,
        active: event.active,
        closed: event.closed,
        polymarketUrl: `${POLYMARKET_BASE}/${event.slug}`,
        bestBid: yesPrice,
        bestAsk: 1 - yesPrice,
        source: "polymarket",
        tags: (event.tags || []).map(t => t.label || t),
        image: event.image || event.icon || '',
        fields,
        marketsCount: (event.markets || []).length,
      };
    });

    return { items: mapped, total: payload.total || mapped.length, page: payload.page || page, limit: payload.limit || limit, tags: payload.tags || [] };
  } catch (err) {
    console.error("Polymarket fetch failed:", err);
    return { items: [], total: 0, page: 1, limit };
  }
}

// Academic field detection based on event text
const FIELD_KEYWORDS = {
  'Computer Science': ['ai', 'algorithm', 'software', 'computing', 'neural', 'model', 'gpt', 'llm', 'transformer', 'crypto', 'blockchain', 'bitcoin', 'ethereum', 'tech', 'app', 'platform', 'quantum computing', 'cybersecurity'],
  'Economics': ['gdp', 'inflation', 'recession', 'market', 'trade', 'tariff', 'fed', 'economy', 'fiscal', 'monetary', 'stock', 'price', 'currency', 'treasury', 'bond', 'debt', 'deficit', 'interest rate', 'unemployment'],
  'Political Science': ['election', 'vote', 'poll', 'president', 'congress', 'senate', 'democrat', 'republican', 'party', 'campaign', 'legislation', 'governor', 'ballot', 'primary', 'inaugur', 'trump', 'biden', 'nomination'],
  'Medicine': ['fda', 'drug', 'vaccine', 'trial', 'disease', 'health', 'patient', 'treatment', 'therapy', 'clinical', 'cancer', 'covid', 'pandemic', 'diagnosis', 'mortality', 'outbreak'],
  'Environmental Science': ['climate', 'carbon', 'emission', 'temperature', 'energy', 'renewable', 'solar', 'wind', 'fossil', 'wildfire', 'drought', 'sea level', 'hurricane'],
  'Physics': ['quantum', 'particle', 'fusion', 'cern', 'spacex', 'nasa', 'orbit', 'rocket', 'satellite', 'space'],
  'Law': ['legal', 'court', 'ruling', 'lawsuit', 'regulation', 'compliance', 'antitrust', 'indictment', 'verdict', 'supreme court'],
  'Geopolitics': ['war', 'conflict', 'military', 'sanctions', 'nato', 'china', 'russia', 'ukraine', 'diplomacy', 'ceasefire', 'invasion'],
  'Finance': ['bitcoin', 'crypto', 'ethereum', 'stock', 's&p', 'nasdaq', 'dow', 'trading', 'hedge', 'derivatives'],
  'Pop Culture': ['oscar', 'grammy', 'superbowl', 'super bowl', 'nfl', 'nba', 'elon', 'musk', 'celebrity', 'streaming', 'netflix', 'tiktok'],
};

function detectEventFields(event) {
  const text = [event.title, event.description, ...(event.markets || []).map(m => m.question)].join(' ').toLowerCase();
  const matched = [];
  for (const [field, keywords] of Object.entries(FIELD_KEYWORDS)) {
    const hits = keywords.filter(k => text.includes(k)).length;
    if (hits >= 1) matched.push({ field, hits });
  }
  return matched.sort((a, b) => b.hits - a.hits).map(m => m.field);
}

export function getPolymarketUrl(slug) {
  return `${POLYMARKET_BASE}/${slug}`;
}

// Export available academic fields for UI filtering
export const ACADEMIC_FIELDS = Object.keys(FIELD_KEYWORDS);
