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
  // Try same-origin proxy first (works on Vercel + Vite dev proxy)
  const params = new URLSearchParams({ limit: String(limit) });
  if (search) params.set('search', search);
  if (tag) params.set('tag', tag);

  try {
    const res = await fetch(`/api/polymarket/events?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {}

  // Fallback: direct fetch to gamma API (may fail due to CORS in browser)
  try {
    const directParams = new URLSearchParams({
      closed: 'false',
      active: 'true',
      limit: String(limit),
      order: 'volume24hr',
      ascending: 'false',
    });
    if (tag) directParams.set('tag', tag);

    const res = await fetch(`${GAMMA_API}/events?${directParams.toString()}`);
    if (res.ok) {
      let data = await res.json();
      if (Array.isArray(data)) {
        // Client-side search filter for direct fetch
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
        return data;
      }
    }
  } catch {}

  return [];
}

export async function fetchPolymarketEvents({ limit = 30, search = '', tag = '' } = {}) {
  try {
    const events = await fetchEventsRaw(limit, { search, tag });
    if (events.length === 0) return [];

    return events.slice(0, limit).map((event) => {
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
      const fields = detectEventFields(event);

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
  } catch (err) {
    console.error("Polymarket fetch failed:", err);
    return [];
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
