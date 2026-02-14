// Vercel serverless function — Knowledge Graph API
// Persistent storage via Vercel KV (Upstash Redis); falls back to in-memory demo

let kv = null;
try {
  const kvModule = await import('@vercel/kv');
  kv = kvModule.kv;
} catch {
  // @vercel/kv not available (local dev or not provisioned) — use in-memory fallback
  kv = null;
}

// Demo papers for initial state / fallback
const DEMO_PAPERS = [
  { id: 'vaswani2017', title: 'Attention Is All You Need', authors: ['Vaswani', 'Shazeer', 'Parmar'], year: 2017, abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...', citationCount: 120000, fieldsOfStudy: ['Computer Science'], source: 'seed' },
  { id: 'devlin2019', title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding', authors: ['Devlin', 'Chang', 'Lee', 'Toutanova'], year: 2019, abstract: 'We introduce a new language representation model called BERT...', citationCount: 85000, fieldsOfStudy: ['Computer Science'], source: 'seed' },
  { id: 'brown2020', title: 'Language Models are Few-Shot Learners', authors: ['Brown', 'Mann', 'Ryder'], year: 2020, abstract: 'Recent work has demonstrated substantial gains on many NLP tasks...', citationCount: 35000, fieldsOfStudy: ['Computer Science'], source: 'seed' },
  { id: 'he2016', title: 'Deep Residual Learning for Image Recognition', authors: ['He', 'Zhang', 'Ren', 'Sun'], year: 2016, abstract: 'Deeper neural networks are more difficult to train...', citationCount: 180000, fieldsOfStudy: ['Computer Science'], source: 'seed' },
  { id: 'goodfellow2014', title: 'Generative Adversarial Networks', authors: ['Goodfellow', 'Pouget-Abadie', 'Mirza'], year: 2014, abstract: 'We propose a new framework for estimating generative models via an adversarial process...', citationCount: 60000, fieldsOfStudy: ['Computer Science'], source: 'seed' },
];

const DEMO_RELATIONS = [
  { source: 'devlin2019', target: 'vaswani2017', type: 'builds_on' },
  { source: 'brown2020', target: 'vaswani2017', type: 'builds_on' },
  { source: 'brown2020', target: 'devlin2019', type: 'extends' },
];

// ── KV helpers ──────────────────────────────────────────────────
const KV_PAPERS_KEY = 'kg:papers';
const KV_RELATIONS_KEY = 'kg:relations';

async function seedIfEmpty() {
  if (!kv) return;
  const existing = await kv.get(KV_PAPERS_KEY);
  if (!existing || (Array.isArray(existing) && existing.length === 0)) {
    await kv.set(KV_PAPERS_KEY, DEMO_PAPERS);
    await kv.set(KV_RELATIONS_KEY, DEMO_RELATIONS);
  }
}

async function getPapers() {
  if (!kv) return DEMO_PAPERS;
  await seedIfEmpty();
  const papers = await kv.get(KV_PAPERS_KEY);
  return papers || DEMO_PAPERS;
}

async function getRelations() {
  if (!kv) return DEMO_RELATIONS;
  const relations = await kv.get(KV_RELATIONS_KEY);
  return relations || DEMO_RELATIONS;
}

async function addPaper(paper) {
  if (!kv) return { ...paper, _note: 'Added (ephemeral — Vercel KV not provisioned)' };
  const papers = await getPapers();
  // Avoid duplicates
  if (!papers.find(p => p.id === paper.id)) {
    papers.push(paper);
    await kv.set(KV_PAPERS_KEY, papers);
  }
  return paper;
}

async function addRelation(relation) {
  if (!kv) return;
  const relations = await getRelations();
  relations.push(relation);
  await kv.set(KV_RELATIONS_KEY, relations);
}

// ── Handler ─────────────────────────────────────────────────────
export default async function handler(req, res) {
  const { action, id, q, depth } = req.query;

  // GET requests
  if (req.method === 'GET') {
    switch (action) {
      case 'papers': {
        const papers = await getPapers();
        if (id) {
          const paper = papers.find(p => p.id === id);
          if (!paper) return res.status(404).json({ error: 'Paper not found' });
          return res.status(200).json(paper);
        }
        return res.status(200).json(papers);
      }

      case 'neighbourhood': {
        if (!id) return res.status(400).json({ error: 'id required' });
        const papers = await getPapers();
        const relations = await getRelations();
        const d = parseInt(depth) || 2;
        const visited = new Set();
        const queue = [{ paperId: id, d: 0 }];
        const nodes = [];
        const edges = [];

        while (queue.length > 0) {
          const { paperId, d: currentDepth } = queue.shift();
          if (visited.has(paperId) || currentDepth > d) continue;
          visited.add(paperId);
          const paper = papers.find(p => p.id === paperId);
          if (paper) nodes.push(paper);

          relations.forEach(r => {
            if (r.source === paperId && !visited.has(r.target)) {
              edges.push(r);
              queue.push({ paperId: r.target, d: currentDepth + 1 });
            }
            if (r.target === paperId && !visited.has(r.source)) {
              edges.push(r);
              queue.push({ paperId: r.source, d: currentDepth + 1 });
            }
          });
        }
        return res.status(200).json({ nodes, edges });
      }

      case 'search': {
        if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
        const papers = await getPapers();
        const query = q.toLowerCase();
        const results = papers.filter(p =>
          p.title.toLowerCase().includes(query) ||
          (p.abstract && p.abstract.toLowerCase().includes(query)) ||
          (p.fieldsOfStudy && p.fieldsOfStudy.some(f => f.toLowerCase().includes(query)))
        );
        return res.status(200).json(results);
      }

      case 'stats': {
        const papers = await getPapers();
        const relations = await getRelations();
        return res.status(200).json({
          paperCount: papers.length,
          authorCount: new Set(papers.flatMap(p => p.authors || [])).size,
          relationCount: relations.length,
          fields: [...new Set(papers.flatMap(p => p.fieldsOfStudy || []))],
        });
      }

      case 'health': {
        const papers = await getPapers();
        const relations = await getRelations();
        return res.status(200).json({ status: 'ok', papers: papers.length, relations: relations.length, persistent: !!kv });
      }

      default: {
        const papers = await getPapers();
        return res.status(200).json(papers);
      }
    }
  }

  // POST — add paper(s)
  if (req.method === 'POST') {
    const body = req.body;

    // Bulk import: { papers: [...], citations: [...] }
    if (body.papers && Array.isArray(body.papers)) {
      const papers = body.papers;
      const citations = body.citations || [];
      let added = 0;

      for (const paper of papers) {
        if (paper.id && paper.title) {
          await addPaper(paper);
          added++;
        }
      }

      for (const rel of citations) {
        if (rel.source && rel.target) {
          await addRelation(rel);
        }
      }

      return res.status(200).json({ added, citations: citations.length, persistent: !!kv });
    }

    // Single paper import
    const paper = body;
    if (!paper.id || !paper.title) {
      return res.status(400).json({ error: 'id and title are required' });
    }
    const saved = await addPaper(paper);

    // If relations are provided, store them too
    if (paper.relations && Array.isArray(paper.relations)) {
      for (const rel of paper.relations) {
        await addRelation(rel);
      }
    }

    return res.status(200).json({ ...saved, persistent: !!kv });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
