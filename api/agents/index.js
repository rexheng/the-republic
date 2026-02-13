// Vercel serverless function — Agent Gateway (stateless agents with LLM)
import { callLLM } from '../_lib/llm.js';

// Agent definitions
const AGENTS = [
  { id: 'iris', name: 'Dr. Iris', role: 'Philosopher King — Deep Literature Analysis', caste: 'philosopher', description: 'Traverses the knowledge graph, identifies gaps, generates hypotheses.', temperature: 0.7 },
  { id: 'atlas', name: 'Prof. Atlas', role: 'Chief Architect — Experimental Design Review', caste: 'guardian', description: 'Evaluates methodology, identifies flaws, suggests improvements.', temperature: 0.4 },
  { id: 'tensor', name: 'Agent Tensor', role: 'Artisan — Computational Realist', caste: 'producer', description: 'Estimates compute costs, replication feasibility, prices truth.', temperature: 0.3 },
  { id: 'sage', name: 'Dr. Sage', role: 'Guardian — Statistical Integrity', caste: 'guardian', description: 'Critiques statistical rigour, reproducibility, methodology.', temperature: 0.3 },
  { id: 'hermes', name: 'Agent Hermes', role: 'Data Oracle — Cross-Reference Verification', caste: 'producer', description: 'Verifies citations, cross-references external sources, detects anomalies.', temperature: 0.5 },
];

// Caste-specific system prompts
const CASTE_PROMPTS = {
  philosopher: `You are {name}, a Philosopher King in The Republic — a decentralised research intelligence platform. Your role: {role}.
You perform deep literature analysis, traverse knowledge graphs, identify research gaps, and generate novel hypotheses. You reason broadly across disciplines, connecting disparate ideas with intellectual rigour. Your responses are thoughtful, well-structured, and cite relevant concepts. Be concise but insightful.`,
  guardian: `You are {name}, a Guardian in The Republic — a decentralised research intelligence platform. Your role: {role}.
You evaluate methodology with surgical precision. You identify statistical flaws, check reproducibility criteria, assess experimental design quality, and critique analytical rigour. You are sceptical, evidence-based, and precise. Flag specific weaknesses and suggest concrete improvements. Be direct and concise.`,
  producer: `You are {name}, a Producer (Artisan) in The Republic — a decentralised research intelligence platform. Your role: {role}.
You estimate practical feasibility: compute costs, replication requirements, data availability, and implementation complexity. You verify citations, cross-reference external sources, and detect anomalies. You are pragmatic, data-driven, and quantitative. Provide actionable estimates and flag discrepancies. Be concise.`,
};

const CASTE_LIMITS = {
  guardian: { tokenLimit: 100000, warningAt: 0.8 },
  philosopher: { tokenLimit: 150000, warningAt: 0.8 },
  producer: { tokenLimit: 80000, warningAt: 0.8 },
};

export default async function handler(req, res) {
  const { action } = req.query;

  if (req.method === 'GET') {
    switch (action) {
      case 'list':
        return res.status(200).json(AGENTS);

      case 'budget': {
        const status = {};
        for (const [caste, limit] of Object.entries(CASTE_LIMITS)) {
          status[caste] = {
            used: 0,
            limit: limit.tokenLimit,
            ratio: 0,
            remaining: limit.tokenLimit,
          };
        }
        return res.status(200).json(status);
      }

      default:
        return res.status(200).json(AGENTS);
    }
  }

  if (req.method === 'POST') {
    if (action === 'chat') {
      const { agentId, task, provider, model, userApiKey, context } = req.body;
      if (!agentId || !task) {
        return res.status(400).json({ error: 'agentId and task are required' });
      }

      const agent = AGENTS.find(a => a.id === agentId);
      if (!agent) {
        return res.status(404).json({ error: `Agent "${agentId}" not found` });
      }

      // Build caste-specific system prompt
      const promptTemplate = CASTE_PROMPTS[agent.caste] || CASTE_PROMPTS.producer;
      const systemPrompt = promptTemplate
        .replace('{name}', agent.name)
        .replace('{role}', agent.role);

      // Build messages
      const messages = [];
      if (context) {
        messages.push({ role: 'user', content: `Context:\n${context}` });
        messages.push({ role: 'assistant', content: 'Understood. I have reviewed the context. What would you like me to analyse?' });
      }
      messages.push({ role: 'user', content: task });

      try {
        const content = await callLLM({
          provider: provider || 'gemini',
          model,
          systemPrompt,
          messages,
          maxTokens: 1500,
          temperature: agent.temperature,
          userApiKey,
        });

        return res.status(200).json({
          agentId,
          agentName: agent.name,
          caste: agent.caste,
          content,
          tokensUsed: content.length, // approximation
          trismResult: null,
        });
      } catch (err) {
        console.error(`Agent ${agentId} LLM error:`, err.message);
        // Fallback: return error message but don't crash
        return res.status(200).json({
          agentId,
          agentName: agent.name,
          caste: agent.caste,
          content: `[${agent.name}] Unable to generate response: ${err.message}. Please configure an LLM API key in Settings.`,
          tokensUsed: 0,
          trismResult: null,
          error: err.message,
        });
      }
    }

    if (action === 'create') {
      const { agentId } = req.body;
      if (!agentId) return res.status(400).json({ error: 'agentId is required' });
      const mockAddr = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      return res.status(200).json({ agentId, wallet: mockAddr });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
