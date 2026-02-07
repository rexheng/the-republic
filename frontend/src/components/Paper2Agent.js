import React, { useState, useEffect, useCallback } from 'react';
import { SEED_PAPERS } from '../utils/seedData';
import { getRepoForPaper, getMCPConfig, getPaperIdsWithRepos } from '../utils/repoData';
import ToolCard from './ToolCard';

const PHASES = [
  { key: 'discovery', label: 'Repository Discovery', duration: 1500 },
  { key: 'analysis', label: 'Code Analysis', duration: 2000 },
  { key: 'ready', label: 'MCP Server Ready', duration: 800 },
];

function Paper2Agent({ agentPaper }) {
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [currentPhase, setCurrentPhase] = useState(-1);
  const [phaseComplete, setPhaseComplete] = useState([false, false, false]);
  const [copied, setCopied] = useState(false);
  const [repo, setRepo] = useState(null);
  const [mcpConfig, setMcpConfig] = useState(null);

  // Papers that have repos
  const papersWithRepos = SEED_PAPERS.filter(p => getPaperIdsWithRepos().includes(p.id));

  // Handle incoming paper from graph
  useEffect(() => {
    if (agentPaper && agentPaper.id) {
      const repoData = getRepoForPaper(agentPaper.id);
      if (repoData) {
        setSelectedPaper(agentPaper);
      }
    }
  }, [agentPaper]);

  // Start the pipeline when a paper is selected
  const startPipeline = useCallback((paper) => {
    const repoData = getRepoForPaper(paper.id);
    if (!repoData) return;

    setSelectedPaper(paper);
    setRepo(repoData);
    setMcpConfig(getMCPConfig(paper.id));
    setCurrentPhase(0);
    setPhaseComplete([false, false, false]);
    setCopied(false);

    // Animate through phases
    let phase = 0;
    const advancePhase = () => {
      setPhaseComplete(prev => {
        const next = [...prev];
        next[phase] = true;
        return next;
      });
      phase++;
      if (phase < PHASES.length) {
        setCurrentPhase(phase);
        setTimeout(advancePhase, PHASES[phase].duration);
      }
    };
    setTimeout(advancePhase, PHASES[0].duration);
  }, []);

  // Auto-start when paper arrives from graph
  useEffect(() => {
    if (agentPaper && agentPaper.id && getRepoForPaper(agentPaper.id)) {
      startPipeline(agentPaper);
    }
  }, [agentPaper, startPipeline]);

  const handlePaperSelect = (e) => {
    const paper = papersWithRepos.find(p => p.id === e.target.value);
    if (paper) {
      startPipeline(paper);
    }
  };

  const handleCopy = () => {
    if (!mcpConfig) return;
    const serverName = Object.keys(mcpConfig.mcpServers)[0];
    const server = mcpConfig.mcpServers[serverName];
    const cmd = `claude mcp add ${serverName} -- ${server.command} ${server.args.join(' ')}`;
    navigator.clipboard.writeText(cmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const connectCommand = mcpConfig ? (() => {
    const serverName = Object.keys(mcpConfig.mcpServers)[0];
    const server = mcpConfig.mcpServers[serverName];
    return `claude mcp add ${serverName} -- ${server.command} ${server.args.join(' ')}`;
  })() : '';

  return (
    <div className="paper2agent">
      <div className="p2a-header">
        <h2>Paper2Agent</h2>
        <p className="p2a-subtitle">
          Transform research papers into runnable MCP servers with callable tools
        </p>
      </div>

      {/* How To Use */}
      {!selectedPaper && (
        <div className="p2a-guide">
          <div className="p2a-guide-title">How it works</div>
          <div className="p2a-guide-steps">
            <div className="p2a-guide-step">
              <span className="p2a-guide-num">1</span>
              <div>
                <strong>Pick a paper</strong>
                <span>Select a paper from the dropdown below, or click "Make Runnable" on any paper with a code icon in the Knowledge Graph tab.</span>
              </div>
            </div>
            <div className="p2a-guide-step">
              <span className="p2a-guide-num">2</span>
              <div>
                <strong>Watch the pipeline</strong>
                <span>We match the paper to its GitHub repo, analyze the code structure, and generate MCP tool definitions automatically.</span>
              </div>
            </div>
            <div className="p2a-guide-step">
              <span className="p2a-guide-num">3</span>
              <div>
                <strong>Connect to Claude</strong>
                <span>Copy the generated command and run it in your terminal. This registers the MCP server with Claude Code so you can call the paper's tools directly from your AI assistant.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Paper Picker */}
      <div className="p2a-picker">
        <label htmlFor="p2a-select">Select a paper with code:</label>
        <select
          id="p2a-select"
          value={selectedPaper?.id || ''}
          onChange={handlePaperSelect}
          className="p2a-select"
        >
          <option value="">-- Choose a paper --</option>
          {papersWithRepos.map(p => (
            <option key={p.id} value={p.id}>
              {p.title} ({p.year})
            </option>
          ))}
        </select>
      </div>

      {/* Pipeline */}
      {selectedPaper && (
        <div className="p2a-pipeline">
          {/* Progress Bar */}
          <div className="p2a-progress-bar">
            {PHASES.map((phase, i) => (
              <div key={phase.key} className="p2a-progress-step">
                <div className={`p2a-progress-dot ${
                  phaseComplete[i] ? 'complete' :
                  currentPhase === i ? 'active' : ''
                }`}>
                  {phaseComplete[i] ? '\u2713' : i + 1}
                </div>
                <span className={`p2a-progress-label ${
                  phaseComplete[i] ? 'complete' : currentPhase === i ? 'active' : ''
                }`}>
                  {phase.label}
                </span>
                {i < PHASES.length - 1 && (
                  <div className={`p2a-progress-line ${phaseComplete[i] ? 'complete' : ''}`} />
                )}
              </div>
            ))}
          </div>

          {/* Phase 1: Repository Discovery */}
          <div className={`p2a-phase ${currentPhase >= 0 ? 'visible' : ''}`}>
            <h3 className="p2a-phase-title">
              <span className="p2a-phase-num">1</span>
              Repository Discovery
              {currentPhase === 0 && !phaseComplete[0] && <span className="p2a-spinner" />}
            </h3>
            {repo && (phaseComplete[0] || currentPhase > 0) && (
              <div className="p2a-repo-card">
                <div className="p2a-repo-header">
                  <span className="p2a-repo-icon">&#128193;</span>
                  <div>
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p2a-repo-name"
                    >
                      {repo.owner}/{repo.name}
                    </a>
                    <p className="p2a-repo-desc">{repo.description}</p>
                  </div>
                </div>
                <div className="p2a-repo-stats">
                  <span className="p2a-repo-stat">
                    <span className="p2a-stat-icon">&#9733;</span>
                    {repo.stars.toLocaleString()}
                  </span>
                  <span className="p2a-repo-stat">
                    <span className="p2a-stat-icon">&#9679;</span>
                    {repo.language}
                  </span>
                  <div className="p2a-repo-topics">
                    {repo.topics.map(t => (
                      <span key={t} className="p2a-topic">{t}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Phase 2: Code Analysis */}
          <div className={`p2a-phase ${currentPhase >= 1 ? 'visible' : ''}`}>
            <h3 className="p2a-phase-title">
              <span className="p2a-phase-num">2</span>
              Code Analysis
              {currentPhase === 1 && !phaseComplete[1] && <span className="p2a-spinner" />}
            </h3>
            {repo && (phaseComplete[1] || currentPhase > 1) && (
              <div className="p2a-analysis">
                {[
                  { label: 'Entry Points', files: repo.detectedFiles.entryPoints, icon: '\u25B6' },
                  { label: 'Model Files', files: repo.detectedFiles.modelFiles, icon: '\uD83E\uDDE0' },
                  { label: 'Notebooks', files: repo.detectedFiles.notebooks, icon: '\uD83D\uDCD3' },
                  { label: 'Configs', files: repo.detectedFiles.configs, icon: '\u2699' },
                ].filter(g => g.files.length > 0).map(group => (
                  <div key={group.label} className="p2a-file-group">
                    <span className="p2a-file-group-label">
                      <span>{group.icon}</span> {group.label}
                    </span>
                    <div className="p2a-file-list">
                      {group.files.map(f => (
                        <code key={f} className="p2a-file">{f}</code>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="p2a-file-group">
                  <span className="p2a-file-group-label">
                    <span>&#128230;</span> Dependencies
                  </span>
                  <div className="p2a-dep-list">
                    {repo.detectedFiles.dependencies.map(d => (
                      <span key={d} className="p2a-dep">{d}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Phase 3: MCP Server Ready */}
          <div className={`p2a-phase ${currentPhase >= 2 ? 'visible' : ''}`}>
            <h3 className="p2a-phase-title">
              <span className="p2a-phase-num">3</span>
              MCP Server Ready
              {currentPhase === 2 && !phaseComplete[2] && <span className="p2a-spinner" />}
            </h3>
            {repo && phaseComplete[2] && (
              <div className="p2a-ready">
                {/* Connect Command */}
                <div className="p2a-connect">
                  <span className="p2a-connect-label">Connect with Claude Code:</span>
                  <div className="p2a-connect-cmd">
                    <code>{connectCommand}</code>
                    <button
                      className="p2a-copy-btn"
                      onClick={handleCopy}
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* MCP Config JSON */}
                <div className="p2a-config-block">
                  <span className="p2a-config-label">MCP Server Configuration</span>
                  <pre className="p2a-config-json">
                    <code>{JSON.stringify(mcpConfig, null, 2)}</code>
                  </pre>
                </div>

                {/* Tool Cards */}
                <div className="p2a-tools">
                  <h4>{repo.mcpTools.length} Available Tools</h4>
                  {repo.mcpTools.map(tool => (
                    <ToolCard key={tool.name} tool={tool} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedPaper && (
        <div className="p2a-empty">
          <div className="p2a-empty-icon">&#129302;</div>
          <h3>No Paper Selected</h3>
          <p>
            Pick a paper from the dropdown above to start the pipeline.
            You can also go to the <strong>Knowledge Graph</strong> tab and click
            "Make Runnable" on any paper with a code icon.
          </p>
          <div className="p2a-empty-stats">
            <strong>{papersWithRepos.length}</strong> papers have linked repositories ready to convert
          </div>
          <div className="p2a-empty-what">
            <strong>What is MCP?</strong> The Model Context Protocol lets AI assistants
            like Claude call external tools. Paper2Agent turns a research repo into a set
            of typed, callable tools &mdash; so you can run inference, train models,
            or preprocess data just by asking Claude.
          </div>
        </div>
      )}
    </div>
  );
}

export default Paper2Agent;
