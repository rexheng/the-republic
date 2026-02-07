// RALPH — Research Autonomous Loop for Progressive Hypotheses
// Event-driven engine: runs frontier discovery in a loop, fetching new papers each iteration
// Now with Semantic Scholar Recommendations + OpenAlex hybrid fetching and verification

import { FRONTIER_AGENTS } from './frontierDefinitions';
import { runAgentPipeline } from './agentOrchestrator';
import { resolveS2PaperId, getRecommendations, getMultiRecommendations, searchPapers as s2Search } from './semanticScholar';
import {
  runHypothesisVerification,
  runSourceVerification,
  runLoopQualityChecks,
  shouldTriggerCheckpoint,
  buildCheckpointSummary,
  getVerificationStats,
} from './verificationEngine';

const OPENALEX_BASE = 'https://api.openalex.org';
const MAILTO = 'research-graph-demo@example.com';
const COOLDOWN_MS = 30000; // 30s between iterations
const MAX_QUERIES_PER_ITER = 5;
const MAX_NEW_PAPERS = 5;
const DEFAULT_MAX_ITERATIONS = 100;

// Reconstruct abstract from OpenAlex inverted index format (same as bulkImport.js)
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return '';
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.join(' ').slice(0, 500);
}

function normalizeOAWork(work) {
  const id = work.id?.startsWith('https://openalex.org/')
    ? work.id.slice(20) : work.id;
  if (!id || !work.display_name) return null;

  const fields = [];
  if (work.topics) {
    for (const t of work.topics.slice(0, 3)) {
      const name = t.field?.display_name || t.domain?.display_name || t.display_name;
      if (name && !fields.includes(name)) fields.push(name);
    }
  } else if (work.concepts) {
    for (const c of work.concepts.slice(0, 2)) {
      if (c.display_name) fields.push(c.display_name);
    }
  }

  return {
    id,
    paperId: id,
    title: work.display_name,
    authors: (work.authorships || []).slice(0, 6).map(a => a.author?.display_name || 'Unknown'),
    year: work.publication_year,
    citationCount: work.cited_by_count || 0,
    abstract: reconstructAbstract(work.abstract_inverted_index),
    fieldsOfStudy: fields,
    source: 'openalex',
    val: Math.max(3, Math.log10((work.cited_by_count || 0) + 1) * 3),
  };
}

async function fetchOpenAlex(query) {
  const url = `${OPENALEX_BASE}/works?filter=default.search:${encodeURIComponent(query)},cited_by_count:>3&per_page=50&sort=cited_by_count:desc&select=id,display_name,publication_year,authorships,cited_by_count,topics,concepts,abstract_inverted_index&mailto=${MAILTO}`;
  try {
    const res = await fetch(url);
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 2000));
      const retry = await fetch(url);
      if (retry.ok) return (await retry.json()).results || [];
      return [];
    }
    if (res.ok) return (await res.json()).results || [];
  } catch (e) {
    console.warn('RALPH OpenAlex fetch failed:', e.message);
  }
  return [];
}

/**
 * Build a modified copy of FRONTIER_AGENTS with user guidance injected into prompts.
 * Nova (first agent) gets the guidance in its system prompt so it steers the whole pipeline.
 */
function buildGuidedAgents(guidance) {
  if (!guidance || !guidance.trim()) return FRONTIER_AGENTS;
  const guidanceBlock = `\n\nUSER RESEARCH DIRECTION:\nThe researcher wants to explore: "${guidance.trim()}"\nPrioritize gaps, hypotheses, and directions that are relevant to this goal. Stay scientifically rigorous but steer your analysis toward this research vision.`;
  return FRONTIER_AGENTS.map(agent => {
    if (agent.id === 'nova') {
      return { ...agent, systemPrompt: agent.systemPrompt + guidanceBlock };
    }
    if (agent.id === 'eureka') {
      return { ...agent, systemPrompt: agent.systemPrompt + `\n\nUSER RESEARCH DIRECTION: "${guidance.trim()}"\nPrioritize hypotheses aligned with this direction.` };
    }
    return agent;
  });
}

/**
 * Extract search queries from a frontier report.
 * Pulls from gaps, hypotheses, emerging directions, and cross-field connections.
 */
function extractQueries(report, guidance) {
  const queries = [];

  // User guidance always gets a query slot
  if (guidance && guidance.trim()) {
    queries.push(guidance.trim().split(/\s+/).slice(0, 10).join(' '));
  }

  // Top gaps by severity
  const gaps = (report.gaps || [])
    .sort((a, b) => {
      const order = { critical: 0, moderate: 1, minor: 2 };
      return (order[a.severity] ?? 2) - (order[b.severity] ?? 2);
    })
    .slice(0, 3);
  for (const g of gaps) {
    const words = (g.gap || '').split(/\s+/).slice(0, 6).join(' ');
    if (words.length > 5) queries.push(words);
  }

  // Hypothesis titles
  for (const h of (report.hypotheses || []).slice(0, 3)) {
    if (h.title && h.title.length > 5) queries.push(h.title);
  }

  // High-potential emerging directions
  for (const d of (report.emergingDirections || [])) {
    if (d.potential === 'high' && d.direction) {
      queries.push(d.direction.split(/\s+/).slice(0, 8).join(' '));
    }
  }

  // Cross-field target fields
  for (const c of (report.crossFieldConnections || []).slice(0, 2)) {
    if (c.targetField) {
      queries.push(`${c.targetField} recent advances`);
    }
  }

  // Deduplicate similar queries (exact + substring)
  const unique = [];
  for (const q of queries) {
    const lower = q.toLowerCase();
    if (!unique.some(u => u.toLowerCase().includes(lower) || lower.includes(u.toLowerCase()))) {
      unique.push(q);
    }
  }

  return unique.slice(0, MAX_QUERIES_PER_ITER);
}

/**
 * Score a paper for relevance to the current iteration's report.
 * Returns 0-100. Now includes influential citation bonus for S2 papers.
 */
function scorePaper(paper, report, guidance) {
  let score = 0;

  // Citation count (log10 scaled, 0-25 pts)
  const citations = paper.citationCount || 0;
  score += Math.min(25, Math.log10(citations + 1) * 6);

  // Influential citation bonus (S2 only, 0-10 pts)
  if (paper.influentialCitationCount) {
    score += Math.min(10, paper.influentialCitationCount * 2);
  }

  // Recency: papers from last 3 years get up to 25 pts
  const currentYear = new Date().getFullYear();
  const age = currentYear - (paper.year || currentYear - 10);
  if (age <= 1) score += 25;
  else if (age <= 2) score += 20;
  else if (age <= 3) score += 15;
  else if (age <= 5) score += 8;

  // Keyword overlap with report content (0-30 pts)
  const reportText = [
    ...(report.gaps || []).map(g => g.gap || ''),
    ...(report.hypotheses || []).map(h => (h.title || '') + ' ' + (h.hypothesis || '')),
    ...(report.emergingDirections || []).map(d => d.direction || ''),
  ].join(' ').toLowerCase();

  const titleWords = (paper.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 4);
  const abstractWords = (paper.abstract || '').toLowerCase().split(/\s+/).filter(w => w.length > 5);
  const allWords = [...new Set([...titleWords, ...abstractWords])];
  const matches = allWords.filter(w => reportText.includes(w)).length;
  score += Math.min(30, matches * 3);

  // Field diversity: bonus for less common fields (0-20 pts)
  const fields = paper.fieldsOfStudy || [];
  if (fields.length > 0) {
    score += Math.min(20, fields.length * 7);
  }

  // Guidance alignment bonus (0-20 pts)
  if (guidance && guidance.trim()) {
    const guidanceWords = guidance.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const paperText = ((paper.title || '') + ' ' + (paper.abstract || '')).toLowerCase();
    const guidanceMatches = guidanceWords.filter(w => paperText.includes(w)).length;
    score += Math.min(20, guidanceMatches * 5);
  }

  return Math.round(Math.min(100, score));
}

const DEFAULT_VERIFICATION_SETTINGS = {
  enabled: true,
  checkpointInterval: 5,
  pauseOnCritical: true,
  runHypothesisCheck: true,
  runSourceCheck: true,
  runLoopQuality: true,
};

/**
 * RALPH Engine — autonomous research discovery loop.
 *
 * Callbacks:
 *   onIterationStart(iterationId, papers)
 *   onIterationComplete(iteration)
 *   onAgentUpdate(agentId, updates)       — forwarded from pipeline
 *   onQueueChange(queue)
 *   onStatusChange(status)
 *   onCooldown(remainingMs)
 *   onVerificationComplete(iterationId, verification)
 *   onCheckpointTriggered(checkpoint)
 *   onVerificationStatsUpdate(stats)
 */
export class RALPHEngine {
  constructor(callbacks = {}) {
    this.callbacks = callbacks;
    this.queue = [];
    this.explored = new Set();
    this.iterations = [];
    this.status = 'idle'; // 'idle' | 'running' | 'paused' | 'stopped' | 'checkpoint'
    this.guidance = '';
    this.maxIterations = DEFAULT_MAX_ITERATIONS;
    this._cooldownTimer = null;
    this._pauseRequested = false;
    this._stopRequested = false;
    this.verificationSettings = { ...DEFAULT_VERIFICATION_SETTINGS };
    this._checkpointResolve = null;
  }

  _setStatus(s) {
    this.status = s;
    this.callbacks.onStatusChange?.(s);
  }

  setVerificationSettings(settings) {
    this.verificationSettings = { ...this.verificationSettings, ...settings };
  }

  resolveCheckpoint(decision, feedback = '', newGuidance = '') {
    if (decision === 'redirect' && newGuidance.trim()) {
      this.guidance = newGuidance.trim();
    }
    if (this._checkpointResolve) {
      this._checkpointResolve({ decision, feedback, newGuidance });
      this._checkpointResolve = null;
    }
  }

  _waitForCheckpoint() {
    return new Promise(resolve => {
      this._checkpointResolve = resolve;
    });
  }

  start(seedPapers, { maxIterations = DEFAULT_MAX_ITERATIONS, guidance = '' } = {}) {
    if (this.status === 'running') return;

    this.queue = [...seedPapers];
    this.explored = new Set();
    this.iterations = [];
    this.guidance = guidance;
    this.maxIterations = maxIterations;
    this._pauseRequested = false;
    this._stopRequested = false;
    this._setStatus('running');
    this.callbacks.onQueueChange?.([...this.queue]);
    this._loop();
  }

  pause() {
    if (this.status !== 'running') return;
    this._pauseRequested = true;
    // Will pause after current iteration finishes
  }

  resume() {
    if (this.status !== 'paused') return;
    this._pauseRequested = false;
    this._stopRequested = false;
    this._setStatus('running');
    this._loop();
  }

  stop() {
    this._stopRequested = true;
    this._pauseRequested = false;
    if (this._cooldownTimer) {
      clearInterval(this._cooldownTimer);
      this._cooldownTimer = null;
    }
    // Resolve any pending checkpoint
    if (this._checkpointResolve) {
      this._checkpointResolve({ decision: 'stop' });
      this._checkpointResolve = null;
    }
    this._setStatus('stopped');
  }

  async _loop() {
    while (
      this.queue.length > 0 &&
      this.iterations.length < this.maxIterations &&
      !this._pauseRequested &&
      !this._stopRequested
    ) {
      await this._runIteration();

      if (this._pauseRequested) {
        this._setStatus('paused');
        return;
      }
      if (this._stopRequested) {
        this._setStatus('stopped');
        return;
      }

      // Check for human-in-the-loop checkpoint
      const lastIter = this.iterations[this.iterations.length - 1];
      const loopQuality = lastIter?.verification?.loopQuality || null;
      if (this.verificationSettings.enabled &&
          shouldTriggerCheckpoint(lastIter?.id, this.verificationSettings, loopQuality)) {
        const checkpoint = {
          triggeredAt: new Date().toISOString(),
          iterationId: lastIter.id,
          ...buildCheckpointSummary(this.iterations),
          status: 'pending',
          userFeedback: '',
          newGuidance: '',
        };
        this.callbacks.onCheckpointTriggered?.(checkpoint);
        this._setStatus('checkpoint');

        const result = await this._waitForCheckpoint();

        if (result.decision === 'stop' || this._stopRequested) {
          this._setStatus('stopped');
          return;
        }
        // Resume running after checkpoint
        this._setStatus('running');
      }

      // Cooldown
      if (this.queue.length > 0 && this.iterations.length < this.maxIterations) {
        await this._cooldown(COOLDOWN_MS);
      }

      if (this._stopRequested) {
        this._setStatus('stopped');
        return;
      }
    }

    // Queue empty — try one more replenishment cycle
    if (
      this.queue.length === 0 &&
      this.iterations.length < this.maxIterations &&
      this.iterations.length > 0 &&
      !this._stopRequested &&
      !this._pauseRequested
    ) {
      const lastIter = this.iterations[this.iterations.length - 1];
      const lastReport = lastIter?.report;
      if (lastReport) {
        const queries = extractQueries(lastReport, this.guidance);
        const newPapers = await this._fetchAndScore(queries, lastReport, this.guidance, lastIter.papers);
        if (newPapers.length > 0) {
          this.queue.push(...newPapers);
          this.callbacks.onQueueChange?.([...this.queue]);
          this._loop(); // Continue with replenished queue
          return;
        }
      }
    }

    if (!this._stopRequested && !this._pauseRequested) {
      this._setStatus('stopped');
    }
  }

  async _runIteration() {
    const batchSize = Math.min(3, this.queue.length);
    const batch = this.queue.splice(0, batchSize);
    const iterationId = this.iterations.length + 1;

    // Mark papers as explored
    for (const p of batch) {
      this.explored.add(p.id || p.paperId || p.title);
    }

    this.callbacks.onQueueChange?.([...this.queue]);
    this.callbacks.onIterationStart?.(iterationId, batch);

    const startTime = Date.now();

    // Run frontier pipeline (with guidance-injected agents if guidance set)
    const agents = buildGuidedAgents(this.guidance);
    const outputs = await runAgentPipeline(agents, batch, {
      onAgentStart: (id) => this.callbacks.onAgentUpdate?.(id, { status: 'working' }),
      onAgentComplete: (id, output, duration) => this.callbacks.onAgentUpdate?.(id, { status: 'complete', output, duration }),
      onAgentError: (id, err, duration) => this.callbacks.onAgentUpdate?.(id, { status: 'error', error: err.message, duration }),
    });

    const report = outputs['frontier-scribe'] || {};
    const durationMs = Date.now() - startTime;

    // Extract queries and fetch new papers (hybrid: OpenAlex + S2 Recommendations)
    const queries = extractQueries(report, this.guidance);
    const newPapers = await this._fetchAndScore(queries, report, this.guidance, batch);
    this.queue.push(...newPapers);
    this.callbacks.onQueueChange?.([...this.queue]);

    // Build iteration record
    const iteration = {
      id: iterationId,
      papers: batch.map(p => ({ title: p.title, id: p.id, year: p.year, fieldsOfStudy: p.fieldsOfStudy })),
      fullPapers: batch,
      report,
      queriesUsed: queries,
      newPapersFound: newPapers.length,
      timestamp: new Date().toISOString(),
      durationMs,
    };

    this.iterations.push(iteration);

    // Run verification (after iteration is recorded)
    if (this.verificationSettings.enabled) {
      await this._runVerification(iteration, batch);
    }

    this.callbacks.onIterationComplete?.(iteration);
  }

  async _runVerification(iteration, batchPapers) {
    const verification = {};

    try {
      // Run hypothesis verification (LLM) and source verification (algorithmic) in parallel
      const tasks = [];

      if (this.verificationSettings.runHypothesisCheck && iteration.report?.hypotheses?.length) {
        tasks.push(
          runHypothesisVerification(iteration.report, batchPapers)
            .then(result => { verification.hypothesisVerification = result; })
            .catch(err => {
              console.warn('Hypothesis verification failed:', err.message);
              verification.hypothesisVerification = { assessments: [], overallNoveltyScore: 0, flaggedHypotheses: [], summary: 'Verification failed: ' + err.message };
            })
        );
      }

      if (this.verificationSettings.runSourceCheck) {
        tasks.push(
          Promise.resolve(runSourceVerification(iteration.report, batchPapers))
            .then(result => { verification.sourceVerification = result; })
        );
      }

      await Promise.all(tasks);

      // Run loop quality checks (needs all iterations)
      if (this.verificationSettings.runLoopQuality) {
        verification.loopQuality = runLoopQualityChecks(
          iteration,
          this.iterations,
          this.queue
        );
      }
    } catch (err) {
      console.warn('Verification error:', err.message);
    }

    // Attach to iteration
    iteration.verification = verification;

    // Fire callbacks
    this.callbacks.onVerificationComplete?.(iteration.id, verification);
    this.callbacks.onVerificationStatsUpdate?.(getVerificationStats(this.iterations));
  }

  async _fetchAndScore(queries, report, guidance, batchPapers = []) {
    const candidates = [];
    const seenIds = new Set();

    // Helper to add candidate with dedup
    const addCandidate = (paper) => {
      const key = paper.id || paper.title;
      if (this.explored.has(key)) return;
      if (seenIds.has(key)) return;
      if (this.queue.some(qp => qp.id === paper.id)) return;
      seenIds.add(key);
      paper._score = scorePaper(paper, report, guidance);
      candidates.push(paper);
    };

    // ── Source 1: OpenAlex keyword search ──
    for (const q of queries) {
      const works = await fetchOpenAlex(q);
      for (const w of works) {
        const paper = normalizeOAWork(w);
        if (paper) addCandidate(paper);
      }
      await new Promise(r => setTimeout(r, 200));
    }

    // ── Source 2: Semantic Scholar Recommendations ──
    try {
      // Resolve S2 IDs for batch papers (non-blocking, best-effort)
      const s2Ids = [];
      for (const p of batchPapers.slice(0, 3)) {
        try {
          const s2Id = await resolveS2PaperId(p);
          if (s2Id) s2Ids.push(s2Id);
        } catch {
          // Skip papers we can't resolve
        }
      }

      if (s2Ids.length > 0) {
        let recs = [];
        if (s2Ids.length >= 2) {
          // Multi-paper recommendations (better for synthesis)
          recs = await getMultiRecommendations(s2Ids, [], 20);
        } else {
          // Single-paper recommendations
          recs = await getRecommendations(s2Ids[0], 15);
        }

        for (const paper of recs) {
          addCandidate(paper);
        }
      }

      // Also try S2 search for the top query (complements OpenAlex with different ranking)
      if (queries.length > 0) {
        const s2Results = await s2Search(queries[0], 10);
        for (const paper of s2Results) {
          addCandidate(paper);
        }
      }
    } catch (e) {
      console.warn('RALPH S2 fetch failed (non-fatal):', e.message);
    }

    // Sort by score descending, take top N
    candidates.sort((a, b) => b._score - a._score);
    const top = candidates.slice(0, MAX_NEW_PAPERS);
    // Clean up score
    for (const p of top) delete p._score;
    return top;
  }

  _cooldown(ms) {
    return new Promise(resolve => {
      let remaining = ms;
      this._cooldownTimer = setInterval(() => {
        remaining -= 1000;
        this.callbacks.onCooldown?.(Math.max(0, remaining));
        if (remaining <= 0 || this._stopRequested || this._pauseRequested) {
          clearInterval(this._cooldownTimer);
          this._cooldownTimer = null;
          resolve();
        }
      }, 1000);
    });
  }

  getAccumulatedStats() {
    let totalGaps = 0, totalHypotheses = 0, totalExperiments = 0, totalConnections = 0;
    const fieldsSet = new Set();
    const breakthroughs = [];

    for (const iter of this.iterations) {
      const r = iter.report;
      if (!r) continue;
      totalGaps += (r.gaps || []).length;
      totalHypotheses += (r.hypotheses || []).length;
      totalExperiments += (r.experiments || []).length;
      totalConnections += (r.crossFieldConnections || []).length;

      for (const g of (r.gaps || [])) {
        if (g.field) fieldsSet.add(g.field);
      }
      for (const c of (r.crossFieldConnections || [])) {
        if (c.sourceField) fieldsSet.add(c.sourceField);
        if (c.targetField) fieldsSet.add(c.targetField);
      }

      // Breakthroughs = breakthrough-level hypotheses
      for (const h of (r.hypotheses || [])) {
        if (h.noveltyLevel === 'breakthrough') {
          breakthroughs.push({
            iterationId: iter.id,
            title: h.title,
            hypothesis: h.hypothesis,
          });
        }
      }
    }

    return {
      totalPapers: this.explored.size,
      totalGaps,
      totalHypotheses,
      totalExperiments,
      totalConnections,
      fieldsTouched: fieldsSet.size,
      breakthroughs,
    };
  }

  exportFullRun() {
    return {
      guidance: this.guidance || null,
      startedAt: this.iterations[0]?.timestamp,
      completedAt: this.iterations[this.iterations.length - 1]?.timestamp,
      totalIterations: this.iterations.length,
      stats: this.getAccumulatedStats(),
      verificationStats: getVerificationStats(this.iterations),
      iterations: this.iterations.map(iter => ({
        ...iter,
        fullPapers: undefined, // Don't export full paper objects (too large)
      })),
    };
  }
}
