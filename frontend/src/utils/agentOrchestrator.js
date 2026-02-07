// AI Research Lab — Generic pipeline orchestrator
// Derives execution phases from agent dependency graphs via topological sort

import { AGENTS } from './agentDefinitions';
import { callLLM } from './llm';

/**
 * Build execution phases from agent dependency graph.
 * Each phase contains agents whose dependencies are all satisfied by earlier phases.
 */
function buildPhases(agents) {
  const phases = [];
  const placed = new Set();

  // Keep going until all agents are placed
  let remaining = [...agents];
  while (remaining.length > 0) {
    const phase = remaining.filter(a =>
      a.dependsOn.every(dep => placed.has(dep))
    );
    if (phase.length === 0) {
      // Circular dependency or missing agents — place remaining as final phase
      phases.push(remaining);
      break;
    }
    phases.push(phase);
    phase.forEach(a => placed.add(a.id));
    remaining = remaining.filter(a => !placed.has(a.id));
  }
  return phases;
}

/**
 * Generic agent pipeline runner.
 * @param {Array} agents - Agent definition array (AGENTS or FRONTIER_AGENTS)
 * @param {Array} papers - Array of paper objects (always an array)
 * @param {Object} callbacks - { onAgentStart, onAgentComplete, onAgentError, onPipelineComplete }
 */
export async function runAgentPipeline(agents, papers, callbacks = {}) {
  const { onAgentStart, onAgentComplete, onAgentError, onPipelineComplete } = callbacks;
  const outputs = {};

  // Build a lookup for this agent set
  const agentMap = Object.fromEntries(agents.map(a => [a.id, a]));

  async function runAgent(agentId) {
    const agent = agentMap[agentId];
    if (!agent) throw new Error(`Unknown agent: ${agentId}`);

    onAgentStart?.(agentId);
    const startTime = Date.now();

    if (agent.isClientSide) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const report = agent.buildReport(papers, outputs);
      const duration = Date.now() - startTime;
      outputs[agentId] = report;
      onAgentComplete?.(agentId, report, duration);
      return report;
    }

    try {
      const userMessage = agent.buildUserMessage(papers, outputs);
      const messages = [{ role: 'user', content: userMessage }];

      const rawText = await callLLM(agent.systemPrompt, messages, {
        maxTokens: 2000,
        temperature: agent.temperature ?? 0.4,
      });

      const parsed = agent.parseOutput(rawText);
      const duration = Date.now() - startTime;
      outputs[agentId] = parsed;
      onAgentComplete?.(agentId, parsed, duration);
      return parsed;
    } catch (err) {
      const duration = Date.now() - startTime;
      onAgentError?.(agentId, err, duration);
      outputs[agentId] = { _error: err.message };
      throw err;
    }
  }

  const phases = buildPhases(agents);

  try {
    for (const phase of phases) {
      if (phase.length === 1) {
        await runAgent(phase[0].id);
      } else {
        await Promise.allSettled(phase.map(a => runAgent(a.id)));
      }
    }
    onPipelineComplete?.(outputs);
    return outputs;
  } catch (err) {
    // Continue running remaining phases even after error
    // (individual agents catch their own errors, so this handles unexpected failures)
    for (const phase of phases) {
      for (const agent of phase) {
        if (!outputs[agent.id]) {
          try {
            await runAgent(agent.id);
          } catch (_) { /* continue */ }
        }
      }
    }
    onPipelineComplete?.(outputs);
    return outputs;
  }
}

/**
 * Backward-compatible wrapper for replication pipeline.
 */
export function runReplicationPipeline(paper, callbacks = {}) {
  return runAgentPipeline(AGENTS, [paper], callbacks);
}
