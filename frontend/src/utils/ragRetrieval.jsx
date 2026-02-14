// RAG retrieval engine for the Research Navigator AI
// Searches in-memory graph data — no external API calls needed for retrieval
// Supports hybrid search: TF-IDF keyword scoring + embedding-based semantic search

import { getStoredApiKey } from './llm';

// ============================================================
// Text search: simple TF-IDF-style keyword scoring
// ============================================================

function tokenize(text) {
  if (!text) return [];
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// Score a paper against a query
function scorePaper(paper, queryTokens) {
  const titleTokens = tokenize(paper.title);
  const abstractTokens = tokenize(paper.abstract);
  let score = 0;

  for (const qt of queryTokens) {
    // Title matches worth 3x
    for (const tt of titleTokens) {
      if (tt === qt) score += 3;
      else if (tt.includes(qt) || qt.includes(tt)) score += 1.5;
    }
    // Abstract matches
    for (const at of abstractTokens) {
      if (at === qt) score += 1;
      else if (at.includes(qt) || qt.includes(at)) score += 0.3;
    }
  }

  // Boost by citation count (log scale, small factor)
  score += Math.log10((paper.citationCount || 0) + 1) * 0.3;

  return score;
}

// Search papers by keyword relevance
export function searchByKeywords(query, papers, limit = 20) {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const scored = papers
    .map(p => ({ paper: p, score: scorePaper(p, queryTokens) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

// ============================================================
// Embedding-based semantic search
// ============================================================

// Module-level embedding cache: paperId -> Float32Array
const embeddingCache = new Map();
let embeddingsAvailable = null; // null = untested, true/false after first attempt

// Cosine similarity between two vectors
function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// Call the embedding API endpoint
async function fetchEmbeddings(texts) {
  const userApiKey = getStoredApiKey();
  const response = await fetch('/api/llm/embed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, ...(userApiKey ? { userApiKey } : {}) }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(err.error || `Embedding error ${response.status}`);
  }

  const data = await response.json();
  return data.embeddings;
}

// Build or update the embedding index for a set of papers
export async function buildEmbeddingIndex(papers) {
  if (embeddingsAvailable === false) return; // previously failed, don't retry

  // Find papers not yet embedded
  const toEmbed = papers.filter(p => !embeddingCache.has(p.id) && (p.title || p.abstract));
  if (toEmbed.length === 0) return;

  try {
    // Batch in groups of 80 (under Gemini's 100 limit with margin)
    for (let i = 0; i < toEmbed.length; i += 80) {
      const batch = toEmbed.slice(i, i + 80);
      const texts = batch.map(p => {
        const title = p.title || '';
        const abstract = (p.abstract || '').slice(0, 500);
        return `${title}. ${abstract}`.trim();
      });

      const vectors = await fetchEmbeddings(texts);
      for (let j = 0; j < batch.length; j++) {
        if (vectors[j]) {
          embeddingCache.set(batch[j].id, new Float32Array(vectors[j]));
        }
      }
    }
    embeddingsAvailable = true;
  } catch (e) {
    console.warn('Embedding index build failed, falling back to keyword search:', e.message);
    embeddingsAvailable = false;
  }
}

// Embed a single query text
async function embedQuery(text) {
  if (embeddingsAvailable === false) return null;
  try {
    const vectors = await fetchEmbeddings([text]);
    embeddingsAvailable = true;
    return vectors[0] ? new Float32Array(vectors[0]) : null;
  } catch (e) {
    console.warn('Query embedding failed:', e.message);
    embeddingsAvailable = false;
    return null;
  }
}

// Search papers by embedding similarity
function searchByEmbeddings(queryVector, papers, limit = 20) {
  if (!queryVector) return [];

  const scored = [];
  for (const paper of papers) {
    const paperVec = embeddingCache.get(paper.id);
    if (!paperVec) continue;
    const sim = cosineSimilarity(queryVector, paperVec);
    if (sim > 0.1) { // minimum similarity threshold
      scored.push({ paper, score: sim });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ============================================================
// Citation graph traversal
// ============================================================

// Build adjacency lists from links
function buildAdjacency(links) {
  const outgoing = new Map(); // source -> [targets]
  const incoming = new Map(); // target -> [sources]

  for (const link of links) {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    if (!outgoing.has(src)) outgoing.set(src, []);
    outgoing.get(src).push(tgt);
    if (!incoming.has(tgt)) incoming.set(tgt, []);
    incoming.get(tgt).push(src);
  }

  return { outgoing, incoming };
}

// Expand a set of paper IDs by N citation hops
export function expandByCitations(paperIds, graphData, hops = 1) {
  const { outgoing, incoming } = buildAdjacency(graphData.links);
  const expanded = new Set(paperIds);

  let frontier = new Set(paperIds);
  for (let h = 0; h < hops; h++) {
    const nextFrontier = new Set();
    for (const id of frontier) {
      for (const neighbor of (outgoing.get(id) || [])) {
        if (!expanded.has(neighbor)) {
          expanded.add(neighbor);
          nextFrontier.add(neighbor);
        }
      }
      for (const neighbor of (incoming.get(id) || [])) {
        if (!expanded.has(neighbor)) {
          expanded.add(neighbor);
          nextFrontier.add(neighbor);
        }
      }
    }
    frontier = nextFrontier;
  }

  return expanded;
}

// BFS to find shortest citation path between two papers
export function findCitationPath(sourceId, targetId, graphData) {
  const { outgoing, incoming } = buildAdjacency(graphData.links);

  // Bidirectional search (treat graph as undirected for path finding)
  const visited = new Map(); // id -> parent
  visited.set(sourceId, null);
  const queue = [sourceId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (current === targetId) {
      // Reconstruct path
      const path = [];
      let node = targetId;
      while (node !== null) {
        path.unshift(node);
        node = visited.get(node);
      }
      return path;
    }

    const neighbors = [
      ...(outgoing.get(current) || []),
      ...(incoming.get(current) || []),
    ];

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.set(neighbor, current);
        queue.push(neighbor);
      }
    }
  }

  return null; // No path found
}

// ============================================================
// Graph analytics
// ============================================================

// Get top papers by citation count, optionally filtered by field
export function getTopPapers(papers, limit = 10, field = null) {
  let filtered = papers;
  if (field) {
    filtered = papers.filter(p =>
      (p.fieldsOfStudy || []).some(f => f.toLowerCase().includes(field.toLowerCase()))
    );
  }
  return filtered
    .sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0))
    .slice(0, limit);
}

// Get field distribution
export function getFieldDistribution(papers) {
  const counts = {};
  for (const paper of papers) {
    const field = (paper.fieldsOfStudy && paper.fieldsOfStudy[0]) || 'Unknown';
    counts[field] = (counts[field] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
}

// Find papers that bridge two fields (cited by papers in both fields)
export function findBridgePapers(graphData, field1, field2) {
  const { incoming } = buildAdjacency(graphData.links);
  const paperMap = new Map(graphData.nodes.map(n => [n.id, n]));
  const bridges = [];

  for (const paper of graphData.nodes) {
    const citers = incoming.get(paper.id) || [];
    if (citers.length < 2) continue;

    let field1Cites = false;
    let field2Cites = false;

    for (const citerId of citers) {
      const citer = paperMap.get(citerId);
      if (!citer) continue;
      const fields = (citer.fieldsOfStudy || []).join(' ').toLowerCase();
      if (fields.includes(field1.toLowerCase())) field1Cites = true;
      if (fields.includes(field2.toLowerCase())) field2Cites = true;
    }

    if (field1Cites && field2Cites) {
      bridges.push(paper);
    }
  }

  return bridges.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
}

// ============================================================
// Context assembly for LLM
// ============================================================

export function formatPaperForContext(paper, index) {
  const fields = (paper.fieldsOfStudy || []).join(', ') || 'Unknown';
  const authors = (paper.authors || []).slice(0, 3).join(', ');
  const abstract = (paper.abstract || '').slice(0, 200);
  const sourceTag = paper.source === 'external' ? ' [EXTERNAL]' : '';
  return `[${index + 1}] "${paper.title}" (${paper.year || '?'}) by ${authors}${sourceTag}
   ID: ${paper.id} | Citations: ${(paper.citationCount || 0).toLocaleString()} | Fields: ${fields}${abstract ? `\n   Abstract: ${abstract}...` : ''}`;
}

export function buildSystemPrompt(graphData, { hasExternalPapers = false } = {}) {
  const n = graphData.nodes.length;
  const e = graphData.links.length;
  const fields = getFieldDistribution(graphData.nodes);

  let externalNote = '';
  if (hasExternalPapers) {
    externalNote = `\n\nEXTERNAL SOURCES:
Some papers below are marked [EXTERNAL] — these come from Semantic Scholar because the knowledge graph had limited coverage on this topic. Prioritize papers from the user's knowledge graph when available, but use external papers to fill gaps. When citing external papers, mention that they are from external sources.`;
  }

  return `You are a research assistant with access to ${n.toLocaleString()} academic papers and ${e.toLocaleString()} citation links.

Fields: ${fields.slice(0, 6).map(([f, c]) => `${f} (${c})`).join(', ')}

RESPONSE FORMAT:
Respond with two labelled sections:

ANSWER: A direct 2-4 sentence answer to the user's question. Cite papers using [1], [2], etc. matching the RELEVANT PAPERS list. Be direct and insightful. Only cite papers you actually reference. Do not include paper titles, citation counts, author names, IDs, or any metadata in your text — these are shown automatically below your answer. Do NOT use markdown formatting (no ##, **, *, -).

EVIDENCE: 1-2 sentences highlighting the single most important piece of supporting evidence from the cited papers and why it matters for the user's question.

SEARCH ACTION:
If the user asks about a topic not covered by the papers in context, include [SEARCH:topic] to fetch papers from Semantic Scholar and add them to the graph.${externalNote}

Example good response:
ANSWER: Transformer architectures revolutionized NLP by replacing recurrence with self-attention [1], enabling parallel training at scale. This led to pretrained models like BERT [3] and GPT [2] that achieve state-of-the-art results across tasks through transfer learning.

EVIDENCE: The original Transformer paper [1] demonstrated that attention-only models could outperform RNN-based seq2seq on machine translation while training significantly faster, establishing the foundation for all subsequent large language models.`;
}

// Hybrid search: combines keyword and semantic results
export async function assembleContext(query, graphData) {
  // 1. Keyword search
  const keywordResults = searchByKeywords(query, graphData.nodes, 15);

  // 2. Semantic search (if embeddings are available)
  let semanticResults = [];
  const queryVector = await embedQuery(query);
  if (queryVector) {
    semanticResults = searchByEmbeddings(queryVector, graphData.nodes, 15);
  }

  // 3. Hybrid merge: combine and deduplicate
  const mergedScores = new Map(); // paperId -> { paper, keywordScore, semanticScore }

  // Normalize keyword scores to [0, 1]
  const maxKeyword = keywordResults.length > 0 ? keywordResults[0].score : 1;
  for (const r of keywordResults) {
    mergedScores.set(r.paper.id, {
      paper: r.paper,
      keywordScore: r.score / maxKeyword,
      semanticScore: 0,
    });
  }

  // Normalize semantic scores (already [0, 1] from cosine similarity)
  for (const r of semanticResults) {
    const existing = mergedScores.get(r.paper.id);
    if (existing) {
      existing.semanticScore = r.score;
    } else {
      mergedScores.set(r.paper.id, {
        paper: r.paper,
        keywordScore: 0,
        semanticScore: r.score,
      });
    }
  }

  // Combined score: weighted blend
  const KEYWORD_WEIGHT = 0.4;
  const SEMANTIC_WEIGHT = 0.6;
  const ranked = Array.from(mergedScores.values())
    .map(entry => ({
      paper: entry.paper,
      score: (entry.keywordScore * KEYWORD_WEIGHT) + (entry.semanticScore * SEMANTIC_WEIGHT),
      keywordScore: entry.keywordScore,
      semanticScore: entry.semanticScore,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);

  const relevantIds = ranked.map(r => r.paper.id);

  // 4. Expand by 1 citation hop for related context
  const expandedIds = expandByCitations(relevantIds, graphData, 1);

  // 5. Build context papers list
  const paperMap = new Map(graphData.nodes.map(n => [n.id, n]));
  const contextPapers = [];

  // First: directly matched papers (with relevance scores)
  for (const r of ranked) {
    contextPapers.push({ ...r.paper, relevanceScore: r.score });
  }

  // Then: citation neighbors (top by citations, capped)
  const neighborPapers = [];
  for (const id of expandedIds) {
    if (!relevantIds.includes(id)) {
      const p = paperMap.get(id);
      if (p) neighborPapers.push(p);
    }
  }
  neighborPapers.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
  contextPapers.push(...neighborPapers.slice(0, 10).map((p, i) => ({
    ...p,
    relevanceScore: Math.max(0.1, 0.4 - i * 0.03), // citation neighbors get lower relevance
  })));

  // 6. Detect sparse coverage
  const topScore = ranked.length > 0 ? ranked[0].score : 0;
  const coverageSparse = ranked.length < 3 || topScore < 0.15;

  // Format for LLM
  const paperContext = contextPapers
    .slice(0, 25)
    .map((p, i) => formatPaperForContext(p, i))
    .join('\n\n');

  return {
    paperContext,
    relevantPaperIds: relevantIds,
    contextPapers: contextPapers.slice(0, 25),
    coverageSparse,
  };
}
