// RAG retrieval engine for the Research Navigator AI
// Searches in-memory graph data — no external API calls needed for retrieval

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
  return `[${index + 1}] "${paper.title}" (${paper.year || '?'}) by ${authors}
   ID: ${paper.id} | Citations: ${(paper.citationCount || 0).toLocaleString()} | Fields: ${fields}${abstract ? `\n   Abstract: ${abstract}...` : ''}`;
}

export function buildSystemPrompt(graphData) {
  const n = graphData.nodes.length;
  const e = graphData.links.length;
  const fields = getFieldDistribution(graphData.nodes);
  const topPapers = getTopPapers(graphData.nodes, 5);

  return `You are the Research Navigator AI for the Research Graph platform — a decentralized knowledge graph built at ETH Oxford 2026.

You have access to a citation graph of ${n.toLocaleString()} academic papers with ${e.toLocaleString()} citation links spanning multiple research fields.

FIELD DISTRIBUTION:
${fields.map(([f, c]) => `- ${f}: ${c} papers`).join('\n')}

MOST CITED PAPERS:
${topPapers.map((p, i) => `${i + 1}. "${p.title}" (${p.year}) — ${(p.citationCount || 0).toLocaleString()} citations`).join('\n')}

YOUR CAPABILITIES:
1. Answer questions about the research landscape using the papers in context
2. Trace citation lineages and explain how ideas evolved
3. Find cross-field connections and bridge papers
4. Recommend papers based on research interests
5. Identify research trends and gaps

GRAPH ACTIONS — include these in your responses to interact with the graph:
- [HIGHLIGHT:id1,id2,id3] — highlight specific papers on the graph
- [ZOOM:id] — zoom the graph to focus on a specific paper
- [PATH:id1,id2] — highlight the citation path between two papers
- [SEARCH:query] — search Semantic Scholar for papers matching the query and ADD them to the graph. Use this when the user asks to find, search for, or add papers on a topic not well covered in the current graph.

RULES:
- Reference papers by their exact title in quotes
- When suggesting papers, include the [HIGHLIGHT:...] action with their IDs
- Be concise but insightful. You're a research guide, not a textbook.
- When you trace a path, use [PATH:...] so the user can see it on the graph
- When asked about a specific paper, use [ZOOM:...] to navigate to it
- When the user asks to search for or add papers on a topic, use [SEARCH:topic] to fetch them from Semantic Scholar and add to the graph. You can use multiple [SEARCH:...] actions for broader searches.`;
}

export function assembleContext(query, graphData) {
  // 1. Keyword search
  const results = searchByKeywords(query, graphData.nodes, 15);
  const relevantIds = results.map(r => r.paper.id);

  // 2. Expand by 1 citation hop for related context
  const expandedIds = expandByCitations(relevantIds, graphData, 1);

  // 3. Get expanded papers, ranked by original score + citation importance
  const paperMap = new Map(graphData.nodes.map(n => [n.id, n]));
  const contextPapers = [];

  // First: directly matched papers
  for (const r of results) {
    contextPapers.push(r.paper);
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
  contextPapers.push(...neighborPapers.slice(0, 10));

  // Format for LLM
  const paperContext = contextPapers
    .slice(0, 25)
    .map((p, i) => formatPaperForContext(p, i))
    .join('\n\n');

  return {
    paperContext,
    relevantPaperIds: relevantIds,
    contextPapers: contextPapers.slice(0, 25),
  };
}
