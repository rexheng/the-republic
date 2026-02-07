// AI Research Lab — Frontier Discovery agent definitions
// 5 agents: Nova (gaps) → Eureka (hypotheses) → (Flux + Nexus parallel) → Scribe (proposal)

const FRONTIER_PREAMBLE = `You are part of an autonomous AI research team that discovers novel research frontiers.
Your teammates: Dr. Nova (frontier scout), Prof. Eureka (hypothesis generator), Dr. Flux (cross-pollinator), Agent Nexus (experiment designer), and Scribe (proposal compiler).
Always respond with valid JSON. Be creative yet rigorous — push boundaries while remaining scientifically grounded.`;

function formatPapers(papers) {
  return papers.map((p, i) => `PAPER ${i + 1}:
TITLE: ${p.title}
AUTHORS: ${(p.authors || []).map(a => typeof a === 'string' ? a : a.name).join(', ')}
YEAR: ${p.year || 'Unknown'}
ABSTRACT: ${p.abstract || 'No abstract available.'}
FIELD: ${(p.fieldsOfStudy || []).join(', ') || 'Unknown'}
CITATIONS: ${p.citationCount || 0}`).join('\n\n');
}

function multiPaperPreamble(papers) {
  if (papers.length === 1) return '';
  return `\nYou are analyzing ${papers.length} papers together. Focus on the GAPS BETWEEN them — what's missing at their intersection, what one enables for the other, and what novel directions emerge from combining their insights.\n`;
}

export const FRONTIER_AGENTS = [
  {
    id: 'nova',
    name: 'Dr. Nova',
    emoji: '\uD83D\uDD2D',
    color: '#E53E3E',
    specialty: 'Frontier Scout',
    dependsOn: [],
    temperature: 0.7,
    systemPrompt: `${FRONTIER_PREAMBLE}

You are Dr. Nova, the Frontier Scout. You identify gaps in current research, challenge weak assumptions, surface open questions, and spot emerging directions that the field hasn't fully explored.

Respond with JSON:
{
  "gaps": [{"id": 1, "gap": "...", "severity": "critical|moderate|minor", "field": "...", "evidence": "..."}],
  "assumptions": [{"assumption": "...", "weakness": "...", "testable": true/false}],
  "openQuestions": ["..."],
  "emergingDirections": [{"direction": "...", "potential": "high|medium|low", "timeframe": "..."}],
  "summary": "2-3 sentence overview of the most promising frontier areas"
}`,
    buildUserMessage(papers, _prev) {
      return `Analyze the frontier of this research — find gaps, weak assumptions, and unexplored directions:
${multiPaperPreamble(papers)}
${formatPapers(papers)}

Identify the most critical gaps, challenge the underlying assumptions, list open questions, and spot emerging research directions.`;
    },
    parseOutput: defaultParse,
  },
  {
    id: 'eureka',
    name: 'Prof. Eureka',
    emoji: '\uD83D\uDCA1',
    color: '#DD6B20',
    specialty: 'Hypothesis Generator',
    dependsOn: ['nova'],
    temperature: 0.7,
    systemPrompt: `${FRONTIER_PREAMBLE}

You are Prof. Eureka, the Hypothesis Generator. Given the gaps and open questions identified by Dr. Nova, you propose 3-5 novel, testable hypotheses that could advance the field.

Respond with JSON:
{
  "hypotheses": [
    {
      "id": 1,
      "title": "Short descriptive title",
      "hypothesis": "Formal hypothesis statement",
      "rationale": "Why this is promising based on the gaps found",
      "noveltyLevel": "incremental|moderate|breakthrough",
      "testability": "easy|moderate|challenging",
      "relatedGapIds": [1, 2]
    }
  ],
  "researchQuestions": ["Broader research questions that frame these hypotheses"],
  "summary": "2-3 sentence overview of the most promising hypotheses"
}`,
    buildUserMessage(papers, prev) {
      return `Generate novel hypotheses based on the frontier analysis:
${multiPaperPreamble(papers)}
${formatPapers(papers)}

DR. NOVA'S FRONTIER ANALYSIS:
${JSON.stringify(prev.nova, null, 2)}

Propose 3-5 novel, testable hypotheses that address the identified gaps and could lead to breakthrough results.`;
    },
    parseOutput: defaultParse,
  },
  {
    id: 'flux',
    name: 'Dr. Flux',
    emoji: '\uD83C\uDF10',
    color: '#38B2AC',
    specialty: 'Cross-Pollinator',
    dependsOn: ['nova', 'eureka'],
    temperature: 0.7,
    systemPrompt: `${FRONTIER_PREAMBLE}

You are Dr. Flux, the Cross-Pollinator. You find surprising connections between different fields, identify methods that could be transferred, and propose unexpected applications of the research.

Respond with JSON:
{
  "crossFieldConnections": [
    {
      "sourceField": "...",
      "targetField": "...",
      "connection": "How these fields relate in a non-obvious way",
      "potential": "high|medium|low"
    }
  ],
  "unexpectedApplications": [
    {
      "application": "...",
      "domain": "...",
      "feasibility": "high|medium|low",
      "impact": "..."
    }
  ],
  "methodTransfers": [
    {
      "method": "...",
      "originField": "...",
      "targetField": "...",
      "adaptation": "What modifications are needed"
    }
  ],
  "collaborationSuggestions": ["Fields/communities that should be talking to each other"],
  "summary": "2-3 sentence overview of the most exciting cross-field opportunities"
}`,
    buildUserMessage(papers, prev) {
      return `Find cross-field connections and unexpected applications:
${multiPaperPreamble(papers)}
${formatPapers(papers)}

DR. NOVA'S GAPS:
${JSON.stringify(prev.nova, null, 2)}

PROF. EUREKA'S HYPOTHESES:
${JSON.stringify(prev.eureka, null, 2)}

Identify surprising interdisciplinary connections, methods that could be borrowed from other fields, and unexpected applications.`;
    },
    parseOutput: defaultParse,
  },
  {
    id: 'nexus',
    name: 'Agent Nexus',
    emoji: '\uD83E\uDDEA',
    color: '#805AD5',
    specialty: 'Experiment Designer',
    dependsOn: ['nova', 'eureka'],
    temperature: 0.7,
    systemPrompt: `${FRONTIER_PREAMBLE}

You are Agent Nexus, the Experiment Designer. Given the hypotheses proposed by Prof. Eureka, you design concrete, actionable experiments to test them.

Respond with JSON:
{
  "experiments": [
    {
      "id": 1,
      "title": "Short experiment title",
      "hypothesisId": 1,
      "methodology": "Step-by-step methodology",
      "datasets": ["Required datasets"],
      "metrics": ["Success metrics"],
      "expectedOutcome": "What a positive result looks like",
      "timeline": "Estimated time to complete",
      "expertise": ["Required expertise areas"]
    }
  ],
  "priorityRanking": [{"experimentId": 1, "reason": "Why this should be done first"}],
  "quickWins": ["Experiments achievable in under a month"],
  "moonshots": ["High-risk, high-reward experiments"],
  "summary": "2-3 sentence overview of the experimental roadmap"
}`,
    buildUserMessage(papers, prev) {
      return `Design experiments to test the proposed hypotheses:
${multiPaperPreamble(papers)}
${formatPapers(papers)}

DR. NOVA'S GAPS:
${JSON.stringify(prev.nova, null, 2)}

PROF. EUREKA'S HYPOTHESES:
${JSON.stringify(prev.eureka, null, 2)}

Design concrete experiments with clear methodologies, datasets, metrics, and timelines. Rank by priority and identify quick wins vs moonshots.`;
    },
    parseOutput: defaultParse,
  },
  {
    id: 'frontier-formal',
    name: 'Dr. Formal',
    emoji: '\uD83D\uDD23',
    color: '#2B6CB0',
    specialty: 'Lean 4 Formalizer',
    dependsOn: ['nova', 'eureka'],
    temperature: 0.3,
    systemPrompt: `${FRONTIER_PREAMBLE}

You are Dr. Formal, the Lean 4 Formalizer. Given the frontier gaps and novel hypotheses, you translate the most promising conjectures into formal Lean 4 theorem statements and proof sketches.

Your goals:
1. Identify the 2-4 most formalizable hypotheses or open questions.
2. Write Lean 4 \`theorem\`, \`lemma\`, or \`conjecture\` (as \`axiom\` or \`sorry\`-based theorem) statements.
3. Provide proof sketches using \`sorry\` for unproven steps, with comments explaining strategy.
4. Define any new types, structures, or mathematical objects needed.
5. Import relevant Mathlib modules where appropriate.
6. Be honest about formalization barriers — what's beyond current Mathlib, what needs new definitions.

Respond with JSON:
{
  "leanCode": "-- Full Lean 4 code block with imports, definitions, theorems, and sorry-based proof sketches",
  "theorems": [
    {
      "name": "theorem_name",
      "claim": "Which hypothesis/gap this formalizes",
      "statement": "The Lean 4 theorem statement",
      "proofStrategy": "Brief description of how one would approach the proof",
      "difficulty": "easy|moderate|hard|open_problem"
    }
  ],
  "definitions": ["Key type/structure definitions needed"],
  "mathlibDeps": ["Mathlib modules that would be needed"],
  "formalizationNotes": "What was easy/hard to formalize, gaps in Mathlib, caveats",
  "completeness": "partial|substantial|full"
}`,
    buildUserMessage(papers, prev) {
      return `Formalize the most promising research hypotheses in Lean 4:
${multiPaperPreamble(papers)}
${formatPapers(papers)}

DR. NOVA'S FRONTIER ANALYSIS (gaps & open questions):
${JSON.stringify(prev.nova, null, 2)}

PROF. EUREKA'S HYPOTHESES:
${JSON.stringify(prev.eureka, null, 2)}

Write Lean 4 theorem/conjecture statements for the 2-4 most promising and formalizable hypotheses. Include imports, type definitions, and proof sketches with sorry placeholders. Comment on proof strategies and Mathlib coverage.`;
    },
    parseOutput: defaultParse,
  },
  {
    id: 'frontier-scribe',
    name: 'Scribe',
    emoji: '\uD83D\uDCDD',
    color: '#667EEA',
    specialty: 'Proposal Compiler',
    dependsOn: ['nova', 'eureka', 'flux', 'nexus', 'frontier-formal'],
    isClientSide: true,
    buildReport(papers, outputs) {
      const nova = outputs.nova || {};
      const eureka = outputs.eureka || {};
      const flux = outputs.flux || {};
      const nexus = outputs.nexus || {};
      const formal = outputs['frontier-formal'] || {};

      const gapCount = (nova.gaps || []).length;
      const hypothesisCount = (eureka.hypotheses || []).length;
      const connectionCount = (flux.crossFieldConnections || []).length;
      const experimentCount = (nexus.experiments || []).length;

      const breakthroughHypotheses = (eureka.hypotheses || []).filter(h => h.noveltyLevel === 'breakthrough').length;
      const noveltyScore = Math.min(100, Math.round(
        (gapCount * 5) + (hypothesisCount * 10) + (breakthroughHypotheses * 15) + (connectionCount * 8) + (experimentCount * 7)
      ));

      return {
        papers: papers.map(p => ({
          title: p.title,
          authors: (p.authors || []).map(a => typeof a === 'string' ? a : a.name),
          year: p.year,
          citations: p.citationCount,
        })),
        noveltyScore,
        stats: { gapCount, hypothesisCount, connectionCount, experimentCount },
        gaps: nova.gaps || [],
        assumptions: nova.assumptions || [],
        openQuestions: nova.openQuestions || [],
        emergingDirections: nova.emergingDirections || [],
        hypotheses: eureka.hypotheses || [],
        researchQuestions: eureka.researchQuestions || [],
        crossFieldConnections: flux.crossFieldConnections || [],
        unexpectedApplications: flux.unexpectedApplications || [],
        methodTransfers: flux.methodTransfers || [],
        collaborationSuggestions: flux.collaborationSuggestions || [],
        experiments: nexus.experiments || [],
        priorityRanking: nexus.priorityRanking || [],
        quickWins: nexus.quickWins || [],
        moonshots: nexus.moonshots || [],
        formalization: {
          leanCode: formal.leanCode || '',
          theorems: formal.theorems || [],
          definitions: formal.definitions || [],
          mathlibDeps: formal.mathlibDeps || [],
          formalizationNotes: formal.formalizationNotes || '',
          completeness: formal.completeness || 'partial',
        },
        summaries: {
          nova: nova.summary || '',
          eureka: eureka.summary || '',
          flux: flux.summary || '',
          nexus: nexus.summary || '',
        },
        generatedAt: new Date().toISOString(),
      };
    },
  },
];

function defaultParse(rawText) {
  try {
    return JSON.parse(rawText);
  } catch (_) {
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try { return JSON.parse(match[1].trim()); } catch (_2) { /* fall through */ }
    }
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try { return JSON.parse(rawText.slice(start, end + 1)); } catch (_3) { /* fall through */ }
    }
    return { _raw: rawText, _parseError: true };
  }
}
