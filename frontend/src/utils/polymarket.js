// Polymarket integration via backend proxy
const BACKEND = 'http://localhost:3001';
const POLYMARKET_BASE = 'https://polymarket.com/event';

// Parse a JSON string field that might already be an array
function parseJsonField(raw, fallback = []) {
  if (!raw) return fallback;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return fallback; }
  }
  return fallback;
}

export async function fetchPolymarketEvents({ limit = 30 } = {}) {
  try {
    const res = await fetch(`${BACKEND}/api/polymarket/events?limit=${limit}`);
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    const events = await res.json();

    if (!Array.isArray(events)) {
      console.error('Polymarket: unexpected response', events);
      return [];
    }

    return events.slice(0, limit).map(event => {
      const market = event.markets?.[0];
      let outcomes = ['Yes', 'No'];
      let outcomePrices = [0.5, 0.5];

      if (market) {
        outcomes = parseJsonField(market.outcomes, ['Yes', 'No']);
        const rawPrices = parseJsonField(market.outcomePrices, []);
        if (rawPrices.length > 0) {
          outcomePrices = rawPrices.map(p => parseFloat(p) || 0.5);
        }
      }

      const yesPrice = outcomePrices[0] || 0.5;

      return {
        id: `poly_${event.id}`,
        polymarketId: event.id,
        slug: event.slug,
        title: event.title,
        description: event.description,
        question: market?.question || event.title,
        outcomes,
        outcomePrices,
        liquidity: event.liquidity || 0,
        volume: event.volume || 0,
        endDate: event.endDate,
        active: event.active,
        polymarketUrl: `${POLYMARKET_BASE}/${event.slug}`,
        bestBid: yesPrice,
        bestAsk: 1 - yesPrice,
        source: 'polymarket',
      };
    });
  } catch (err) {
    console.error('Polymarket fetch failed:', err);
    return [];
  }
}

export function getPolymarketUrl(slug) {
  return `${POLYMARKET_BASE}/${slug}`;
}
