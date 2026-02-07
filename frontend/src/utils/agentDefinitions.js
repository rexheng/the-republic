// AI Research Lab — Agent definitions for the autonomous replication pipeline

const TEAM_PREAMBLE = `You are part of an autonomous AI research team replicating scientific papers.
Your teammates: Dr. Iris (literature analyst), Prof. Atlas (replication architect), Agent Tensor (computation simulator), Dr. Sage (peer reviewer), and Scribe (report compiler).
Always respond with valid JSON. Be rigorous, specific, and concise.`;

export const AGENTS = [
  {
    id: 'iris',
    name: 'Dr. Iris',
    emoji: '\uD83D\uDD0D',
    color: '#4A90D9',
    specialty: 'Literature Analyst',
    dependsOn: [],
    systemPrompt: `${TEAM_PREAMBLE}

You are Dr. Iris, the Literature Analyst. Your job is to extract the core claims, methodology, key variables, and testable hypotheses from a research paper.

Respond with JSON:
{
  "claims": [{"id": 1, "claim": "...", "type": "primary|secondary", "testable": true/false}],
  "methodology": {"approach": "...", "dataset": "...", "metrics": ["..."], "baseline": "..."},
  "variables": {"independent": ["..."], "dependent": ["..."], "controlled": ["..."]},
  "keyFindings": ["..."],
  "replicationDifficulty": "low|medium|high",
  "summary": "2-3 sentence summary of what needs to be replicated"
}`,
    buildUserMessage(papers, _prev) {
      const paper = papers[0];
      return `Analyze this paper for replication:

TITLE: ${paper.title}
AUTHORS: ${(paper.authors || []).map(a => typeof a === 'string' ? a : a.name).join(', ')}
YEAR: ${paper.year || 'Unknown'}
ABSTRACT: ${paper.abstract || 'No abstract available.'}
FIELD: ${(paper.fieldsOfStudy || []).join(', ') || 'Unknown'}
CITATIONS: ${paper.citationCount || 0}

Extract the core claims, methodology, variables, and assess replication difficulty.`;
    },
    parseOutput: defaultParse,
  },
  {
    id: 'atlas',
    name: 'Prof. Atlas',
    emoji: '\uD83D\uDCD0',
    color: '#48BB78',
    specialty: 'Replication Architect',
    dependsOn: ['iris'],
    systemPrompt: `${TEAM_PREAMBLE}

You are Prof. Atlas, the Replication Architect. Given Dr. Iris's analysis, you design a concrete replication plan and write Python pseudocode.

Respond with JSON:
{
  "plan": [{"step": 1, "title": "...", "description": "...", "estimatedHours": N}],
  "pythonCode": "# Python pseudocode for the replication\\nimport ...\\n...",
  "requirements": ["numpy", "torch", ...],
  "dataNeeded": {"source": "...", "size": "...", "access": "public|restricted|proprietary"},
  "estimatedTimeline": "X days/weeks",
  "feasibilityScore": 0-100,
  "risks": ["..."]
}`,
    buildUserMessage(papers, prev) {
      const paper = papers[0];
      const iris = prev.iris;
      return `Design a replication plan for this paper based on Dr. Iris's analysis:

PAPER: ${paper.title} (${paper.year})
ABSTRACT: ${paper.abstract || 'N/A'}

DR. IRIS'S ANALYSIS:
${JSON.stringify(iris, null, 2)}

Create a step-by-step replication plan with Python pseudocode, requirements, and feasibility assessment.`;
    },
    parseOutput: defaultParse,
  },
  {
    id: 'tensor',
    name: 'Agent Tensor',
    emoji: '\u2699\uFE0F',
    color: '#ECC94B',
    specialty: 'Computation Simulator',
    dependsOn: ['iris', 'atlas'],
    systemPrompt: `${TEAM_PREAMBLE}

You are Agent Tensor, the Computation Simulator. Given the analysis and replication plan, you simulate what the results would look like, estimate computational costs, and predict how closely a replication might match.

Respond with JSON:
{
  "simulatedResults": [{"metric": "...", "original": "...", "estimated": "...", "confidence": "high|medium|low"}],
  "computationalCost": {"gpuHours": N, "estimatedCost": "$X", "hardware": "..."},
  "matchPrediction": 0-100,
  "bottlenecks": ["..."],
  "alternativeApproaches": [{"name": "...", "tradeoff": "..."}]
}`,
    buildUserMessage(papers, prev) {
      const paper = papers[0];
      return `Simulate replication results for:

PAPER: ${paper.title} (${paper.year})

DR. IRIS'S FINDINGS:
${JSON.stringify(prev.iris, null, 2)}

PROF. ATLAS'S PLAN:
${JSON.stringify(prev.atlas, null, 2)}

Estimate computational costs, predict result match rates, and identify bottlenecks.`;
    },
    parseOutput: defaultParse,
  },
  {
    id: 'sage',
    name: 'Dr. Sage',
    emoji: '\uD83E\uDDD1\u200D\u2696\uFE0F',
    color: '#9F7AEA',
    specialty: 'Peer Reviewer',
    dependsOn: ['iris', 'atlas'],
    systemPrompt: `${TEAM_PREAMBLE}

You are Dr. Sage, the Peer Reviewer. You critically evaluate the paper and the replication plan, scoring rigor and identifying potential issues.

Respond with JSON:
{
  "scores": {
    "methodologicalRigor": {"score": 1-10, "justification": "..."},
    "reproducibility": {"score": 1-10, "justification": "..."},
    "statisticalValidity": {"score": 1-10, "justification": "..."},
    "novelty": {"score": 1-10, "justification": "..."},
    "clarity": {"score": 1-10, "justification": "..."}
  },
  "overallScore": 1-10,
  "verdict": "Accept|Revise|Reject",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "recommendations": ["..."],
  "replicationVerdict": "Replication Likely|Partial Replication|Replication Unlikely"
}`,
    buildUserMessage(papers, prev) {
      const paper = papers[0];
      return `Peer review this paper and its replication plan:

PAPER: ${paper.title} (${paper.year})
ABSTRACT: ${paper.abstract || 'N/A'}

DR. IRIS'S ANALYSIS:
${JSON.stringify(prev.iris, null, 2)}

PROF. ATLAS'S REPLICATION PLAN:
${JSON.stringify(prev.atlas, null, 2)}

Score the paper on 5 dimensions, provide verdict, strengths, weaknesses, and replication likelihood.`;
    },
    parseOutput: defaultParse,
  },
  {
    id: 'formal',
    name: 'Dr. Formal',
    emoji: '\uD83D\uDD23',
    color: '#2B6CB0',
    specialty: 'Lean 4 Formalizer',
    dependsOn: ['iris', 'atlas'],
    temperature: 0.3,
    systemPrompt: `${TEAM_PREAMBLE}

You are Dr. Formal, the Lean 4 Formalizer. Given the extracted claims and replication plan, you translate the paper's key results into formal Lean 4 theorem statements and proof sketches.

Your goals:
1. Identify the 2-4 most important claims/results that can be meaningfully formalized.
2. Write Lean 4 \`theorem\` or \`lemma\` statements capturing each claim.
3. Provide proof sketches using \`sorry\` for unproven steps, with comments explaining the strategy.
4. Import relevant Mathlib modules where appropriate.
5. Be honest about what CAN vs CANNOT be easily formalized.

Respond with JSON:
{
  "leanCode": "-- Full Lean 4 code block with imports, definitions, theorems, and sorry-based proof sketches",
  "theorems": [
    {
      "name": "theorem_name",
      "claim": "Which paper claim this formalizes",
      "statement": "The Lean 4 theorem statement",
      "proofStrategy": "Brief description of how one would prove this",
      "difficulty": "easy|moderate|hard|open_problem"
    }
  ],
  "definitions": ["Key type/structure definitions needed"],
  "mathlibDeps": ["Mathlib modules that would be needed"],
  "formalizationNotes": "What was easy/hard to formalize, what's missing from Mathlib, caveats",
  "completeness": "partial|substantial|full"
}`,
    buildUserMessage(papers, prev) {
      const paper = papers[0];
      const iris = prev.iris;
      const atlas = prev.atlas;
      return `Formalize the key results of this paper in Lean 4:

PAPER: ${paper.title} (${paper.year})
ABSTRACT: ${paper.abstract || 'N/A'}
FIELD: ${(paper.fieldsOfStudy || []).join(', ') || 'Unknown'}

DR. IRIS'S ANALYSIS (claims & methodology):
${JSON.stringify(iris, null, 2)}

PROF. ATLAS'S PLAN (mathematical structure):
${JSON.stringify(atlas, null, 2)}

Write Lean 4 theorem statements for the 2-4 most important claims. Include imports, type definitions, and proof sketches with sorry placeholders. Add comments explaining the proof strategy.`;
    },
    parseOutput: defaultParse,
  },
  {
    id: 'scribe',
    name: 'Scribe',
    emoji: '\uD83D\uDCDD',
    color: '#667EEA',
    specialty: 'Report Compiler',
    dependsOn: ['iris', 'atlas', 'tensor', 'sage', 'formal'],
    isClientSide: true,
    buildReport(papers, outputs) {
      const paper = papers[0];
      const iris = outputs.iris || {};
      const atlas = outputs.atlas || {};
      const tensor = outputs.tensor || {};
      const sage = outputs.sage || {};
      const formal = outputs.formal || {};

      const verdict = sage.replicationVerdict || tensor.matchPrediction >= 70
        ? 'Replication Likely'
        : tensor.matchPrediction >= 40
          ? 'Partial Replication'
          : 'Replication Unlikely';

      const feasibility = atlas.feasibilityScore ?? Math.round((tensor.matchPrediction || 50) * 0.8);

      return {
        paper: {
          title: paper.title,
          authors: (paper.authors || []).map(a => typeof a === 'string' ? a : a.name),
          year: paper.year,
          citations: paper.citationCount,
        },
        verdict: sage.replicationVerdict || verdict,
        feasibilityScore: feasibility,
        overallScore: sage.overallScore || null,
        claims: iris.claims || [],
        methodology: iris.methodology || {},
        replicationPlan: atlas.plan || [],
        pythonCode: atlas.pythonCode || '',
        requirements: atlas.requirements || [],
        simulatedResults: tensor.simulatedResults || [],
        computationalCost: tensor.computationalCost || {},
        matchPrediction: tensor.matchPrediction || null,
        peerReview: {
          scores: sage.scores || {},
          verdict: sage.verdict || 'N/A',
          strengths: sage.strengths || [],
          weaknesses: sage.weaknesses || [],
          recommendations: sage.recommendations || [],
        },
        formalization: {
          leanCode: formal.leanCode || '',
          theorems: formal.theorems || [],
          definitions: formal.definitions || [],
          mathlibDeps: formal.mathlibDeps || [],
          formalizationNotes: formal.formalizationNotes || '',
          completeness: formal.completeness || 'partial',
        },
        generatedAt: new Date().toISOString(),
      };
    },
  },
];

function defaultParse(rawText) {
  // Try direct JSON parse
  try {
    return JSON.parse(rawText);
  } catch (_) {
    // Try extracting JSON from markdown code blocks
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch (_2) { /* fall through */ }
    }
    // Try finding first { to last }
    const start = rawText.indexOf('{');
    const end = rawText.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(rawText.slice(start, end + 1));
      } catch (_3) { /* fall through */ }
    }
    // Return as raw text wrapper
    return { _raw: rawText, _parseError: true };
  }
}

export function getAgent(id) {
  return AGENTS.find(a => a.id === id);
}
