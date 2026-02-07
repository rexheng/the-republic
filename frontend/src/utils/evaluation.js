// Evaluation schema, Bayesian aggregation, and confidence scoring
// Inspired by The Unjournal's multi-dimensional evaluation — then improved

// ─── Evaluation Dimensions ────────────────────────────────────────
// Each dimension: key, label, description, weight in composite
export const DIMENSIONS = [
  {
    key: 'overall',
    label: 'Overall Assessment',
    short: 'Overall',
    description: 'Holistic quality considering all factors below',
    weight: 0.25,
    color: '#667eea',
  },
  {
    key: 'novelty',
    label: 'Novelty & Contribution',
    short: 'Novelty',
    description: 'How original is the work? Does it advance the field meaningfully?',
    weight: 0.15,
    color: '#e53e3e',
  },
  {
    key: 'methodology',
    label: 'Methodology & Rigor',
    short: 'Methods',
    description: 'Are methods sound, well-justified, and robust to assumptions?',
    weight: 0.20,
    color: '#38a169',
  },
  {
    key: 'reproducibility',
    label: 'Reproducibility',
    short: 'Reprod.',
    description: 'Can results be independently replicated? Is data/code available?',
    weight: 0.15,
    color: '#d69e2e',
  },
  {
    key: 'clarity',
    label: 'Clarity & Communication',
    short: 'Clarity',
    description: 'Is the paper well-written with clear reasoning and honest limitations?',
    weight: 0.10,
    color: '#805ad5',
  },
  {
    key: 'impact',
    label: 'Real-World Impact',
    short: 'Impact',
    description: 'Does this matter beyond academia? Practical applications?',
    weight: 0.15,
    color: '#dd6b20',
  },
];

// Journal tier scale (0-5) — dual prediction like Unjournal
export const JOURNAL_TIERS = [
  { value: 0, label: 'Unpublishable', description: 'Fundamental flaws, not suitable for publication' },
  { value: 1, label: 'Workshop / Preprint', description: 'Interesting ideas but not peer-review ready' },
  { value: 2, label: 'Regional / Low-tier', description: 'Publishable in niche or lower-tier venues' },
  { value: 3, label: 'Solid Field Journal', description: 'Good work, competitive at mid-tier venues' },
  { value: 4, label: 'Top Conference / Journal', description: 'NeurIPS, ICML, Nature sub-journals caliber' },
  { value: 5, label: 'Landmark Paper', description: 'Field-defining work. "Attention Is All You Need" caliber' },
];

// ─── Default evaluation state ─────────────────────────────────────

export function createBlankEvaluation() {
  const scores = {};
  DIMENSIONS.forEach(d => {
    scores[d.key] = {
      midpoint: 50,
      low: 30,    // 90% CI lower bound
      high: 70,   // 90% CI upper bound
    };
  });

  return {
    scores,
    replicationProbability: 50,  // 0-100% — "Will this replicate?"
    tierShould: 3,               // Where SHOULD this publish? (merit)
    tierWill: 3,                 // Where WILL this publish? (prediction)
    writtenEvaluation: '',
    strengths: '',
    weaknesses: '',
    suggestions: '',
  };
}

// ─── Composite Score ──────────────────────────────────────────────
// Weighted average of dimension midpoints

export function computeCompositeScore(scores) {
  let weighted = 0;
  let totalWeight = 0;
  DIMENSIONS.forEach(d => {
    if (scores[d.key]) {
      weighted += scores[d.key].midpoint * d.weight;
      totalWeight += d.weight;
    }
  });
  return totalWeight > 0 ? Math.round(weighted / totalWeight) : 50;
}

// Map 0-100 composite to on-chain uint8 (1-10)
export function compositeToOnChain(composite) {
  return Math.max(1, Math.min(10, Math.round(composite / 10)));
}

// ─── Bayesian Aggregation ─────────────────────────────────────────
// Better than Unjournal: they show individual scores side-by-side.
// We compute a proper precision-weighted aggregate with updated CIs.

// Convert a reviewer's CI to precision (inverse variance)
// Tighter CI = higher precision = more weight
function ciToPrecision(low, high) {
  // 90% CI spans ~3.29 standard deviations
  const span = Math.max(high - low, 1);
  const sigma = span / 3.29;
  return 1 / (sigma * sigma);
}

// Aggregate multiple evaluations for a single dimension
export function aggregateDimension(evaluations, dimensionKey) {
  if (!evaluations || evaluations.length === 0) {
    return { midpoint: 50, low: 20, high: 80, confidence: 0, n: 0 };
  }

  let totalPrecision = 0;
  let weightedSum = 0;

  evaluations.forEach(ev => {
    const score = ev.scores[dimensionKey];
    if (!score) return;
    const precision = ciToPrecision(score.low, score.high);
    totalPrecision += precision;
    weightedSum += score.midpoint * precision;
  });

  if (totalPrecision === 0) {
    return { midpoint: 50, low: 20, high: 80, confidence: 0, n: evaluations.length };
  }

  const aggregateMean = weightedSum / totalPrecision;
  const aggregateSigma = Math.sqrt(1 / totalPrecision);
  const ci90 = aggregateSigma * 1.645; // 90% CI half-width

  // Confidence: 0-100, increases with more reviewers and tighter CIs
  // A single reviewer with wide CI might be 30%, three with tight CIs might be 85%
  const confidence = Math.min(100, Math.round(
    100 * (1 - Math.exp(-0.5 * totalPrecision * evaluations.length / 100))
  ));

  return {
    midpoint: Math.round(Math.max(0, Math.min(100, aggregateMean))),
    low: Math.round(Math.max(0, aggregateMean - ci90)),
    high: Math.round(Math.min(100, aggregateMean + ci90)),
    confidence,
    n: evaluations.length,
  };
}

// Full aggregate across all dimensions
export function aggregateEvaluations(evaluations) {
  if (!evaluations || evaluations.length === 0) return null;

  const aggregated = {};
  DIMENSIONS.forEach(d => {
    aggregated[d.key] = aggregateDimension(evaluations, d.key);
  });

  // Aggregate replication probability (simple weighted mean by CI tightness)
  let repTotal = 0;
  let repWeight = 0;
  evaluations.forEach(ev => {
    if (ev.replicationProbability != null) {
      repTotal += ev.replicationProbability;
      repWeight += 1;
    }
  });
  const replicationProbability = repWeight > 0 ? Math.round(repTotal / repWeight) : null;

  // Aggregate tier predictions
  let tierShouldSum = 0;
  let tierWillSum = 0;
  evaluations.forEach(ev => {
    tierShouldSum += ev.tierShould || 0;
    tierWillSum += ev.tierWill || 0;
  });
  const n = evaluations.length;

  // Composite from aggregated midpoints
  const compositeScores = {};
  DIMENSIONS.forEach(d => {
    compositeScores[d.key] = { midpoint: aggregated[d.key].midpoint };
  });

  return {
    dimensions: aggregated,
    composite: computeCompositeScore(compositeScores),
    replicationProbability,
    tierShould: Math.round(tierShouldSum / n * 10) / 10,
    tierWill: Math.round(tierWillSum / n * 10) / 10,
    tierGap: Math.round((tierShouldSum - tierWillSum) / n * 10) / 10,
    reviewCount: n,
  };
}

// ─── Confidence Grade ─────────────────────────────────────────────
// Human-readable label for confidence level

export function confidenceGrade(confidence) {
  if (confidence >= 80) return { label: 'High', color: '#38a169' };
  if (confidence >= 50) return { label: 'Moderate', color: '#d69e2e' };
  if (confidence >= 25) return { label: 'Low', color: '#dd6b20' };
  return { label: 'Very Low', color: '#e53e3e' };
}

// ─── Serialize for IPFS ───────────────────────────────────────────

export function serializeEvaluation(evaluation, reviewerAddress) {
  return JSON.stringify({
    version: '2.0',
    schema: 'research-graph-evaluation',
    reviewer: reviewerAddress,
    timestamp: Date.now(),
    ...evaluation,
  });
}
