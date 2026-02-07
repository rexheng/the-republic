// Bulk import papers from OpenAlex — 250M+ works, free API, full citation graph
// referenced_works comes back in every response = no extra calls for edges

const OPENALEX_BASE = 'https://api.openalex.org';
const CACHE_KEY = 'rg_bulk_openalex_v2';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours

// Polite pool: adding email gives priority and avoids shared rate limits
const MAILTO = 'research-graph-demo@example.com';

// Diverse queries across academic fields — each fetches 200 papers via cursor pagination
// OpenAlex field IDs: https://docs.openalex.org/api-entities/topics
const DEFAULT_QUERIES = [
  // Computer Science / AI
  { filter: 'default.search:deep learning transformer', label: 'Deep Learning', pages: 3 },
  { filter: 'default.search:large language models', label: 'LLMs', pages: 2 },
  { filter: 'default.search:computer vision object detection', label: 'Computer Vision', pages: 2 },
  { filter: 'default.search:reinforcement learning policy optimization', label: 'RL', pages: 1 },
  { filter: 'default.search:graph neural network', label: 'GNNs', pages: 1 },
  // Biology & Medicine
  { filter: 'default.search:CRISPR gene editing', label: 'CRISPR', pages: 2 },
  { filter: 'default.search:protein structure prediction folding', label: 'Protein Folding', pages: 2 },
  { filter: 'default.search:single cell RNA sequencing transcriptomics', label: 'scRNA-seq', pages: 2 },
  { filter: 'default.search:mRNA vaccine immunology', label: 'mRNA Vaccines', pages: 1 },
  { filter: 'default.search:cancer immunotherapy checkpoint', label: 'Immunotherapy', pages: 1 },
  // Physics
  { filter: 'default.search:quantum computing qubit error correction', label: 'Quantum Computing', pages: 2 },
  { filter: 'default.search:gravitational waves LIGO detection', label: 'Gravitational Waves', pages: 1 },
  { filter: 'default.search:topological insulators quantum materials', label: 'Topological Materials', pages: 1 },
  // Neuroscience
  { filter: 'default.search:brain connectome neural circuits imaging', label: 'Connectomics', pages: 2 },
  { filter: 'default.search:optogenetics neural activity', label: 'Optogenetics', pages: 1 },
  // Climate & Environment
  { filter: 'default.search:climate change modeling prediction earth system', label: 'Climate Modeling', pages: 2 },
  { filter: 'default.search:renewable energy solar photovoltaic perovskite', label: 'Solar Energy', pages: 1 },
  // Mathematics & Statistics
  { filter: 'default.search:Bayesian inference probabilistic programming', label: 'Bayesian Stats', pages: 1 },
  // Chemistry & Materials
  { filter: 'default.search:lithium ion battery solid state electrolyte', label: 'Batteries', pages: 1 },
  { filter: 'default.search:metal organic framework porous materials', label: 'MOFs', pages: 1 },
];

// Reconstruct abstract from OpenAlex inverted index format
function reconstructAbstract(invertedIndex) {
  if (!invertedIndex) return '';
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word;
    }
  }
  return words.join(' ').slice(0, 500); // cap at 500 chars
}

// Extract short OpenAlex ID from full URL: "https://openalex.org/W123" -> "W123"
function oaId(fullId) {
  if (!fullId) return null;
  if (fullId.startsWith('https://openalex.org/')) return fullId.slice(20);
  return fullId;
}

// Map OpenAlex topic domains to our field names
function mapFieldsOfStudy(work) {
  if (!work.topics || work.topics.length === 0) {
    // Fallback to concepts if topics missing
    if (work.concepts && work.concepts.length > 0) {
      return work.concepts.slice(0, 2).map(c => c.display_name);
    }
    return [];
  }
  const fields = [];
  const seen = new Set();
  for (const topic of work.topics.slice(0, 3)) {
    const domain = topic.domain?.display_name;
    const field = topic.field?.display_name;
    const name = field || domain || topic.display_name;
    if (name && !seen.has(name)) {
      seen.add(name);
      fields.push(name);
    }
  }
  return fields;
}

// Normalize an OpenAlex work to our graph node format
function normalizeWork(work) {
  const id = oaId(work.id);
  if (!id || !work.display_name) return null;

  return {
    id,
    paperId: id,
    title: work.display_name,
    authors: (work.authorships || []).slice(0, 8).map(a => a.author?.display_name || 'Unknown'),
    year: work.publication_year,
    citationCount: work.cited_by_count || 0,
    abstract: reconstructAbstract(work.abstract_inverted_index),
    fieldsOfStudy: mapFieldsOfStudy(work),
    doi: work.doi ? work.doi.replace('https://doi.org/', '') : null,
    source: 'openalex',
    val: Math.max(3, Math.log10((work.cited_by_count || 0) + 1) * 3),
    // Store referenced_works temporarily for edge construction
    _refs: (work.referenced_works || []).map(oaId).filter(Boolean),
  };
}

async function fetchPage(url) {
  try {
    const res = await fetch(url);
    if (res.status === 429) {
      // Rate limited — wait 2s and retry once
      await new Promise(r => setTimeout(r, 2000));
      const retry = await fetch(url);
      if (retry.ok) return await retry.json();
      return null;
    }
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('OpenAlex fetch failed:', e.message);
  }
  return null;
}

function getCachedData() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, timestamp } = JSON.parse(raw);
    if (Date.now() - timestamp < CACHE_TTL) return data;
  } catch (e) {
    // Corrupted cache
  }
  return null;
}

function setCachedData(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {
    // localStorage full — try to store just papers without abstracts
    try {
      const slim = {
        papers: data.papers.map(p => ({ ...p, abstract: '' })),
        citations: data.citations,
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data: slim, timestamp: Date.now() }));
    } catch (e2) {
      // Really full, skip caching
    }
  }
}

export async function bulkFetchPapers(queries = DEFAULT_QUERIES, onProgress = null) {
  // Check cache first
  const cached = getCachedData();
  if (cached) {
    if (onProgress) onProgress({
      phase: 'complete',
      total: cached.papers.length,
      citations: cached.citations.length,
      field: 'cache',
    });
    return cached;
  }

  const allPapers = new Map(); // oaId -> normalized paper
  let totalFetched = 0;
  let queryIndex = 0;

  for (const query of queries) {
    const { filter, label, pages = 1 } = query;
    let cursor = '*';

    for (let page = 0; page < pages; page++) {
      if (onProgress) {
        onProgress({
          phase: 'fetching',
          field: label,
          queryIndex,
          totalQueries: queries.length,
          total: totalFetched,
          page: page + 1,
          totalPages: pages,
        });
      }

      const url = `${OPENALEX_BASE}/works?filter=${encodeURIComponent(filter)},cited_by_count:>5&per-page=200&cursor=${cursor}&sort=cited_by_count:desc&select=id,doi,display_name,publication_year,authorships,cited_by_count,referenced_works,topics,concepts,abstract_inverted_index&mailto=${MAILTO}`;

      const data = await fetchPage(url);
      if (!data?.results) break;

      for (const work of data.results) {
        const paper = normalizeWork(work);
        if (paper && !allPapers.has(paper.id)) {
          allPapers.set(paper.id, paper);
          totalFetched++;
        }
      }

      // Get next cursor
      cursor = data.meta?.next_cursor;
      if (!cursor) break;

      // Small delay between pages
      await new Promise(r => setTimeout(r, 50));
    }

    queryIndex++;
    // Small delay between queries
    await new Promise(r => setTimeout(r, 30));
  }

  // Build citation edges where both papers are in our set
  if (onProgress) onProgress({ phase: 'building_edges', total: totalFetched });

  const papers = Array.from(allPapers.values());
  const paperIds = new Set(allPapers.keys());
  const citations = [];
  const citationSet = new Set();

  for (const paper of papers) {
    for (const refId of paper._refs) {
      if (paperIds.has(refId)) {
        const key = `${paper.id}->${refId}`;
        if (!citationSet.has(key)) {
          citationSet.add(key);
          citations.push({ source: paper.id, target: refId });
        }
      }
    }
    // Clean up temp reference data
    delete paper._refs;
  }

  const result = { papers, citations };
  setCachedData(result);

  if (onProgress) onProgress({
    phase: 'complete',
    total: papers.length,
    citations: citations.length,
  });

  return result;
}

export function clearBulkCache() {
  localStorage.removeItem(CACHE_KEY);
}
