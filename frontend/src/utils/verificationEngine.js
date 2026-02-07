// RALPH Verification Engine — 4 Pillars of Quality Control
// No React dependency — pure functions + 1 LLM call for hypothesis verification

import { callLLM } from './llm';

// ─── Pillar 1: Hypothesis Verification (1 LLM call) ─────────────────────────

const VERIFICATION_SYSTEM_PROMPT = `You are a rigorous scientific hypothesis verifier. Given a set of hypotheses generated from paper analysis, evaluate each one on three dimensions:

1. **Novelty**: Is this hypothesis genuinely new, or does it restate known findings?
2. **Evidence Support**: Is there sufficient evidence from the input papers to ground this hypothesis?
3. **Feasibility**: Could this hypothesis realistically be tested with current methods/technology?

For each hypothesis, provide:
- novelty: { verdict: "novel"|"incremental"|"known", evidence: "brief explanation" }
- evidenceSupport: { verdict: "strong"|"moderate"|"weak"|"unsupported", reasoning: "brief explanation" }
- feasibility: { verdict: "feasible"|"challenging"|"infeasible", reasoning: "brief explanation" }
- confidence: 0-100 (your confidence in this assessment)

Also provide:
- overallNoveltyScore: 0-100 (average novelty across all hypotheses)
- flaggedHypotheses: array of indices (0-based) for hypotheses that are weak on 2+ dimensions
- summary: 1-2 sentence overall assessment

Respond ONLY with valid JSON. No markdown, no code fences.`;

function buildVerificationUserMessage(report, papers) {
  const hypotheses = (report.hypotheses || []).map((h, i) => ({
    id: i,
    title: h.title || `Hypothesis ${i + 1}`,
    hypothesis: h.hypothesis || '',
    noveltyLevel: h.noveltyLevel || 'unknown',
    rationale: h.rationale || '',
  }));

  const gaps = (report.gaps || []).slice(0, 5).map(g => ({
    gap: g.gap,
    severity: g.severity,
    field: g.field,
  }));

  const paperSummaries = papers.slice(0, 5).map(p => ({
    title: p.title,
    abstract: (p.abstract || '').slice(0, 300),
    fields: p.fieldsOfStudy || [],
  }));

  return JSON.stringify({ hypotheses, gaps, paperSummaries }, null, 2);
}

function parseVerificationResponse(raw) {
  try {
    // Strip markdown fences if present
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    const parsed = JSON.parse(cleaned);
    return {
      assessments: Array.isArray(parsed.assessments) ? parsed.assessments : [],
      overallNoveltyScore: typeof parsed.overallNoveltyScore === 'number' ? parsed.overallNoveltyScore : 50,
      flaggedHypotheses: Array.isArray(parsed.flaggedHypotheses) ? parsed.flaggedHypotheses : [],
      summary: parsed.summary || 'Verification complete.',
    };
  } catch {
    return {
      assessments: [],
      overallNoveltyScore: 50,
      flaggedHypotheses: [],
      summary: 'Failed to parse verification response.',
    };
  }
}

export async function runHypothesisVerification(report, papers) {
  if (!report?.hypotheses?.length) {
    return {
      assessments: [],
      overallNoveltyScore: 0,
      flaggedHypotheses: [],
      summary: 'No hypotheses to verify.',
    };
  }

  const userMessage = buildVerificationUserMessage(report, papers);
  const raw = await callLLM(VERIFICATION_SYSTEM_PROMPT, [
    { role: 'user', content: userMessage },
  ], { temperature: 0.3, maxTokens: 2000 });

  return parseVerificationResponse(raw);
}


// ─── Pillar 2: Loop Quality Checks (algorithmic, 0 LLM calls) ───────────────

function computeWordSet(text) {
  return new Set(
    (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3)
  );
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 1;
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

export function runLoopQualityChecks(currentIteration, allIterations, queue) {
  const alerts = [];
  const recentIterations = allIterations.slice(-3);

  // 1. Novelty trend: are recent noveltyScores declining or consistently low?
  const recentScores = recentIterations
    .map(it => it.report?.noveltyScore ?? it.verification?.hypothesisVerification?.overallNoveltyScore ?? null)
    .filter(s => s !== null);

  let noveltyTrend = 'stable';
  if (recentScores.length >= 3) {
    const allLow = recentScores.every(s => s < 30);
    const declining = recentScores[0] > recentScores[1] && recentScores[1] > recentScores[2];
    if (allLow) {
      noveltyTrend = 'critical';
      alerts.push({ pillar: 'novelty', message: 'Novelty scores consistently below 30% for last 3 iterations', severity: 'critical' });
    } else if (declining) {
      noveltyTrend = 'declining';
      alerts.push({ pillar: 'novelty', message: 'Novelty scores declining over last 3 iterations', severity: 'warning' });
    }
  }

  // 2. Query diversity: Jaccard uniqueness across all queries
  const allQueries = allIterations.flatMap(it => it.queriesUsed || []);
  const queryCounts = {};
  for (const q of allQueries) {
    const key = q.toLowerCase().trim();
    queryCounts[key] = (queryCounts[key] || 0) + 1;
  }
  const repeatedQueries = Object.entries(queryCounts).filter(([, count]) => count >= 3);
  const uniqueQueries = new Set(allQueries.map(q => q.toLowerCase().trim()));
  const queryDiversity = allQueries.length > 0 ? Math.round((uniqueQueries.size / allQueries.length) * 100) : 100;

  if (repeatedQueries.length > 0) {
    alerts.push({ pillar: 'queryDiversity', message: `${repeatedQueries.length} queries repeated 3+ times`, severity: 'warning' });
  }

  // 3. Field coverage: stuck in one field for 3+ iterations?
  const recentFields = recentIterations.map(it => {
    const fields = new Set();
    for (const g of (it.report?.gaps || [])) {
      if (g.field) fields.add(g.field);
    }
    for (const c of (it.report?.crossFieldConnections || [])) {
      if (c.sourceField) fields.add(c.sourceField);
      if (c.targetField) fields.add(c.targetField);
    }
    return fields;
  });

  let fieldCoverage = 'diverse';
  if (recentFields.length >= 3) {
    const allFields = new Set();
    for (const fs of recentFields) {
      for (const f of fs) allFields.add(f);
    }
    if (allFields.size <= 1 && allFields.size > 0) {
      fieldCoverage = 'stuck';
      alerts.push({ pillar: 'fieldCoverage', message: `Stuck in single field "${[...allFields][0]}" for 3+ iterations`, severity: 'warning' });
    } else if (allFields.size <= 2) {
      fieldCoverage = 'narrow';
    }
  }

  // 4. Hypothesis redundancy: word-overlap similarity between hypotheses
  const allHypotheses = allIterations.flatMap(it =>
    (it.report?.hypotheses || []).map(h => ({
      text: (h.title || '') + ' ' + (h.hypothesis || ''),
      iterationId: it.id,
    }))
  );

  let hypothesisRedundancy = 0;
  let duplicateCount = 0;
  if (allHypotheses.length >= 2) {
    const wordSets = allHypotheses.map(h => computeWordSet(h.text));
    for (let i = 0; i < wordSets.length; i++) {
      for (let j = i + 1; j < wordSets.length; j++) {
        if (jaccardSimilarity(wordSets[i], wordSets[j]) > 0.7) {
          duplicateCount++;
        }
      }
    }
    const totalPairs = (allHypotheses.length * (allHypotheses.length - 1)) / 2;
    hypothesisRedundancy = totalPairs > 0 ? Math.round((duplicateCount / totalPairs) * 100) : 0;
  }

  if (duplicateCount > 3) {
    alerts.push({ pillar: 'hypothesisRedundancy', message: `${duplicateCount} near-duplicate hypothesis pairs detected`, severity: 'warning' });
  }

  // 5. Queue health: trending grow/stable/shrink
  const recentNewPapers = recentIterations.map(it => it.newPapersFound || 0);
  let queueHealth = 'stable';
  if (recentNewPapers.length >= 2) {
    const avg = recentNewPapers.reduce((a, b) => a + b, 0) / recentNewPapers.length;
    if (avg >= 4) queueHealth = 'growing';
    else if (avg <= 1) {
      queueHealth = 'shrinking';
      if (queue.length <= 2) {
        alerts.push({ pillar: 'queueHealth', message: 'Queue nearly empty, discovery may stall', severity: 'warning' });
      }
    }
  }

  // Overall health
  const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
  const warningAlerts = alerts.filter(a => a.severity === 'warning').length;
  let overallHealth = 'healthy';
  if (criticalAlerts > 0) overallHealth = 'critical';
  else if (warningAlerts >= 2) overallHealth = 'warning';

  return {
    noveltyTrend,
    queryDiversity,
    fieldCoverage,
    hypothesisRedundancy,
    duplicateCount,
    queueHealth,
    overallHealth,
    alerts,
  };
}


// ─── Pillar 3: Source Verification (algorithmic, 0 LLM calls) ────────────────

export function runSourceVerification(report, papers) {
  const hallucinationFlags = [];

  // 1. Paper-field alignment: do gap fields match paper fieldsOfStudy?
  const paperFields = new Set();
  for (const p of papers) {
    for (const f of (p.fieldsOfStudy || [])) {
      paperFields.add(f.toLowerCase());
    }
  }

  let fieldAlignmentMatches = 0;
  let fieldAlignmentTotal = 0;
  const fieldMismatches = [];
  for (const gap of (report.gaps || [])) {
    if (gap.field) {
      fieldAlignmentTotal++;
      if (paperFields.has(gap.field.toLowerCase()) ||
          [...paperFields].some(pf => pf.includes(gap.field.toLowerCase()) || gap.field.toLowerCase().includes(pf))) {
        fieldAlignmentMatches++;
      } else {
        fieldMismatches.push({ gap: gap.gap?.slice(0, 60), field: gap.field });
      }
    }
  }
  const fieldAlignmentScore = fieldAlignmentTotal > 0
    ? Math.round((fieldAlignmentMatches / fieldAlignmentTotal) * 100) : 100;

  // 2. Gap relevance: do gap descriptions reference concepts from papers?
  const paperText = papers.map(p =>
    ((p.title || '') + ' ' + (p.abstract || '')).toLowerCase()
  ).join(' ');
  const paperWords = computeWordSet(paperText);

  let gapRelevanceMatches = 0;
  const unreferenced = [];
  const gaps = report.gaps || [];
  for (const gap of gaps) {
    const gapWords = computeWordSet(gap.gap || '');
    const overlap = [...gapWords].filter(w => paperWords.has(w)).length;
    if (overlap >= 2) {
      gapRelevanceMatches++;
    } else {
      unreferenced.push(gap.gap?.slice(0, 80));
    }
  }
  const gapRelevanceScore = gaps.length > 0
    ? Math.round((gapRelevanceMatches / gaps.length) * 100) : 100;

  // 3. Hallucination flags: cross-field connections referencing unrelated fields
  for (const conn of (report.crossFieldConnections || [])) {
    const src = (conn.sourceField || '').toLowerCase();
    const tgt = (conn.targetField || '').toLowerCase();
    const srcRelated = [...paperFields].some(pf => pf.includes(src) || src.includes(pf));
    const tgtRelated = [...paperFields].some(pf => pf.includes(tgt) || tgt.includes(pf));

    if (!srcRelated && !tgtRelated) {
      hallucinationFlags.push({
        claim: `Cross-field: ${conn.sourceField} <-> ${conn.targetField}`,
        issue: 'Neither field appears related to input papers',
        severity: 'high',
      });
    } else if (!srcRelated || !tgtRelated) {
      hallucinationFlags.push({
        claim: `Cross-field: ${conn.sourceField} <-> ${conn.targetField}`,
        issue: `"${!srcRelated ? conn.sourceField : conn.targetField}" not grounded in input papers`,
        severity: 'medium',
      });
    }
  }

  // 4. Experiments with no grounding
  for (const exp of (report.experiments || [])) {
    const expWords = computeWordSet((exp.title || '') + ' ' + (exp.methodology || ''));
    const overlap = [...expWords].filter(w => paperWords.has(w)).length;
    if (overlap < 2) {
      hallucinationFlags.push({
        claim: `Experiment: ${(exp.title || '').slice(0, 60)}`,
        issue: 'Minimal overlap with input paper content',
        severity: 'low',
      });
    }
  }

  const overallTrust = Math.round(
    (fieldAlignmentScore * 0.3 + gapRelevanceScore * 0.4 + (100 - Math.min(100, hallucinationFlags.length * 20)) * 0.3)
  );

  return {
    paperFieldAlignment: { score: fieldAlignmentScore, mismatches: fieldMismatches },
    gapRelevance: { score: gapRelevanceScore, unreferenced },
    hallucinationFlags,
    overallTrust,
  };
}


// ─── Pillar 4: Human-in-the-Loop Checkpoints ────────────────────────────────

export function shouldTriggerCheckpoint(iterationId, settings, loopQuality) {
  if (!settings?.enabled) return false;

  // Trigger on critical loop quality
  if (settings.pauseOnCritical && loopQuality?.overallHealth === 'critical') return true;

  // Trigger every N iterations
  const interval = settings.checkpointInterval || 5;
  if (iterationId > 0 && iterationId % interval === 0) return true;

  return false;
}

export function buildCheckpointSummary(iterations) {
  const recent = iterations.slice(-10);
  const topFindings = [];

  for (const iter of recent) {
    const r = iter.report;
    if (!r) continue;

    // Breakthrough hypotheses
    for (const h of (r.hypotheses || [])) {
      if (h.noveltyLevel === 'breakthrough') {
        topFindings.push({
          type: 'breakthrough',
          iterationId: iter.id,
          text: h.title || h.hypothesis,
        });
      }
    }

    // Critical gaps
    for (const g of (r.gaps || [])) {
      if (g.severity === 'critical') {
        topFindings.push({
          type: 'critical_gap',
          iterationId: iter.id,
          text: g.gap?.slice(0, 100),
        });
      }
    }

    // High-potential directions
    for (const d of (r.emergingDirections || [])) {
      if (d.potential === 'high') {
        topFindings.push({
          type: 'direction',
          iterationId: iter.id,
          text: d.direction,
        });
      }
    }
  }

  // Aggregate verification stats from recent iterations
  let totalChecked = 0;
  let noveltySum = 0;
  let trustSum = 0;
  let totalFlags = 0;
  let verifiedCount = 0;

  for (const iter of recent) {
    const v = iter.verification;
    if (!v) continue;
    verifiedCount++;

    if (v.hypothesisVerification) {
      totalChecked += v.hypothesisVerification.assessments?.length || 0;
      noveltySum += v.hypothesisVerification.overallNoveltyScore || 0;
    }
    if (v.sourceVerification) {
      trustSum += v.sourceVerification.overallTrust || 0;
      totalFlags += v.sourceVerification.hallucinationFlags?.length || 0;
    }
  }

  return {
    totalFindings: topFindings.length,
    topFindings,
    stats: {
      hypothesesChecked: totalChecked,
      avgNovelty: verifiedCount > 0 ? Math.round(noveltySum / verifiedCount) : 0,
      avgTrust: verifiedCount > 0 ? Math.round(trustSum / verifiedCount) : 0,
      totalFlags,
    },
  };
}


// ─── Aggregation Helper ─────────────────────────────────────────────────────

export function getVerificationStats(iterations) {
  let totalHypothesesChecked = 0;
  let noveltySum = 0;
  let trustSum = 0;
  let totalHallucinationFlags = 0;
  let verifiedCount = 0;
  const loopHealthHistory = [];
  const alertCounts = { critical: 0, warning: 0 };

  for (const iter of iterations) {
    const v = iter.verification;
    if (!v) continue;
    verifiedCount++;

    if (v.hypothesisVerification) {
      totalHypothesesChecked += v.hypothesisVerification.assessments?.length || 0;
      noveltySum += v.hypothesisVerification.overallNoveltyScore || 0;
    }

    if (v.sourceVerification) {
      trustSum += v.sourceVerification.overallTrust || 0;
      totalHallucinationFlags += v.sourceVerification.hallucinationFlags?.length || 0;
    }

    if (v.loopQuality) {
      loopHealthHistory.push(v.loopQuality.overallHealth);
      for (const alert of (v.loopQuality.alerts || [])) {
        if (alert.severity === 'critical') alertCounts.critical++;
        else if (alert.severity === 'warning') alertCounts.warning++;
      }
    }
  }

  return {
    totalHypothesesChecked,
    avgNoveltyScore: verifiedCount > 0 ? Math.round(noveltySum / verifiedCount) : 0,
    avgTrustScore: verifiedCount > 0 ? Math.round(trustSum / verifiedCount) : 0,
    totalHallucinationFlags,
    verifiedCount,
    loopHealthHistory,
    alertCounts,
  };
}
