import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AGENTS } from '../utils/agentDefinitions';
import { FRONTIER_AGENTS } from '../utils/frontierDefinitions';
import { runAgentPipeline, runReplicationPipeline } from '../utils/agentOrchestrator';
import { getLLMConfig } from '../utils/llm';
import AgentCard from './AgentCard';
import ReplicationReport from './ReplicationReport';
import FrontierReport from './FrontierReport';
import RALPHMode from './RALPHMode';
import { SEED_PAPERS } from '../utils/seedData';
import { PROBLEM_SETS } from '../utils/problemSets';

const CUSTOM_PAPERS_KEY = 'lab-custom-papers';

function loadCustomPapers() {
  try {
    const raw = localStorage.getItem(CUSTOM_PAPERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCustomPapers(papers) {
  localStorage.setItem(CUSTOM_PAPERS_KEY, JSON.stringify(papers));
}

function buildInitialStates(agents) {
  return Object.fromEntries(
    agents.map(a => [a.id, { status: 'pending', output: null, duration: null, error: null }])
  );
}

/**
 * Build a modified copy of agents with user custom prompt injected into system prompts.
 */
function buildPromptedAgents(agents, customPrompt) {
  if (!customPrompt || !customPrompt.trim()) return agents;
  const block = `\n\nUSER INSTRUCTIONS:\n${customPrompt.trim()}`;
  return agents.map(agent => {
    if (agent.isClientSide) return agent;
    return { ...agent, systemPrompt: agent.systemPrompt + block };
  });
}

function AIResearchLab({ labPaper }) {
  const [papers] = useState(() => SEED_PAPERS);
  const [customPapers, setCustomPapers] = useState(loadCustomPapers);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('replicate'); // 'replicate' | 'discover' | 'ralph'
  const [paperSource, setPaperSource] = useState('papers'); // 'papers' | 'problems'
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [selectedPapers, setSelectedPapers] = useState([]); // for discover multi-select
  const [agentStates, setAgentStates] = useState(buildInitialStates(AGENTS));
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [finalReport, setFinalReport] = useState(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formAuthors, setFormAuthors] = useState('');
  const [formYear, setFormYear] = useState('');
  const [formAbstract, setFormAbstract] = useState('');
  const [formFields, setFormFields] = useState('');
  const pipelineRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeAgents = useMemo(
    () => (mode === 'discover' || mode === 'ralph') ? FRONTIER_AGENTS : AGENTS,
    [mode]
  );

  useEffect(() => {
    const { apiKey } = getLLMConfig();
    setHasApiKey(!!apiKey);
  }, []);

  // Handle incoming paper from PaperDetail "Replicate" button
  useEffect(() => {
    if (labPaper && labPaper.title) {
      setSelectedPaper(labPaper);
      setMode('replicate');
    }
  }, [labPaper]);

  // Reset state on mode switch
  const handleModeSwitch = useCallback((newMode) => {
    if (newMode === mode) return;
    setMode(newMode);
    setPipelineRunning(false);
    setFinalReport(null);
    if (newMode === 'discover' || newMode === 'ralph') {
      setAgentStates(buildInitialStates(FRONTIER_AGENTS));
      // Carry over selected paper to multi-select
      setSelectedPapers(selectedPaper ? [selectedPaper] : []);
    } else {
      setAgentStates(buildInitialStates(AGENTS));
      // Carry over first selected paper
      if (selectedPapers.length > 0) setSelectedPaper(selectedPapers[0]);
      setSelectedPapers([]);
    }
  }, [mode, selectedPaper, selectedPapers]);

  // Build the display list based on paper source
  const displayPapers = useMemo(() => {
    if (paperSource === 'problems') return PROBLEM_SETS;
    return [...customPapers, ...papers];
  }, [paperSource, customPapers, papers]);

  const filteredPapers = displayPapers.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.authors || []).some(a => {
      const name = typeof a === 'string' ? a : a.name;
      return name.toLowerCase().includes(search.toLowerCase());
    })
  );

  const updateAgent = useCallback((id, updates) => {
    setAgentStates(prev => ({ ...prev, [id]: { ...prev[id], ...updates } }));
  }, []);

  // Toggle paper in multi-select (discover mode)
  const togglePaperSelection = useCallback((paper) => {
    setSelectedPapers(prev => {
      const exists = prev.find(p => p.id === paper.id);
      if (exists) return prev.filter(p => p.id !== paper.id);
      if (prev.length >= 5) return prev; // max 5
      return [...prev, paper];
    });
    setFinalReport(null);
    setAgentStates(buildInitialStates(FRONTIER_AGENTS));
  }, []);

  // Select paper in replicate mode
  const selectPaper = useCallback((paper) => {
    setSelectedPaper(paper);
    setFinalReport(null);
    setAgentStates(buildInitialStates(AGENTS));
  }, []);

  // Custom paper form handlers
  const handleAddCustomPaper = useCallback(() => {
    if (!formTitle.trim() || !formAbstract.trim()) return;
    const newPaper = {
      id: `custom-${Date.now()}`,
      title: formTitle.trim(),
      authors: formAuthors ? formAuthors.split(',').map(a => a.trim()).filter(Boolean) : [],
      year: formYear ? parseInt(formYear, 10) : new Date().getFullYear(),
      abstract: formAbstract.trim(),
      fieldsOfStudy: formFields ? formFields.split(',').map(f => f.trim()).filter(Boolean) : [],
      citationCount: 0,
      source: 'custom',
    };
    const updated = [newPaper, ...customPapers];
    setCustomPapers(updated);
    saveCustomPapers(updated);
    setFormTitle('');
    setFormAuthors('');
    setFormYear('');
    setFormAbstract('');
    setFormFields('');
    setShowCustomForm(false);
    // Auto-select the new paper
    if (mode === 'discover' || mode === 'ralph') {
      setSelectedPapers(prev => prev.length < 5 ? [...prev, newPaper] : prev);
    } else {
      setSelectedPaper(newPaper);
    }
  }, [formTitle, formAuthors, formYear, formAbstract, formFields, customPapers, mode]);

  const handleRemoveCustomPaper = useCallback((paperId) => {
    const updated = customPapers.filter(p => p.id !== paperId);
    setCustomPapers(updated);
    saveCustomPapers(updated);
    // Deselect if removed
    if (selectedPaper?.id === paperId) setSelectedPaper(null);
    setSelectedPapers(prev => prev.filter(p => p.id !== paperId));
  }, [customPapers, selectedPaper]);

  const handleFileUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormAbstract(ev.target.result);
    };
    reader.readAsText(file);
    // Reset input so same file can be re-uploaded
    e.target.value = '';
  }, []);

  const startPipeline = useCallback(async () => {
    if (pipelineRunning) return;

    const { apiKey } = getLLMConfig();
    if (!apiKey) { setHasApiKey(false); return; }

    const papersForPipeline = mode === 'discover' ? selectedPapers : [selectedPaper];
    if (papersForPipeline.length === 0 || !papersForPipeline[0]) return;

    setPipelineRunning(true);
    setFinalReport(null);
    setAgentStates(buildInitialStates(activeAgents));

    const callbacks = {
      onAgentStart: (id) => updateAgent(id, { status: 'working', output: null, duration: null, error: null }),
      onAgentComplete: (id, output, duration) => updateAgent(id, { status: 'complete', output, duration }),
      onAgentError: (id, error, duration) => updateAgent(id, { status: 'error', error: error.message, duration }),
      onPipelineComplete: (outputs) => {
        const scribeId = mode === 'discover' ? 'frontier-scribe' : 'scribe';
        if (outputs[scribeId]) setFinalReport(outputs[scribeId]);
        setPipelineRunning(false);
      },
    };

    // Inject custom prompt into agents if set
    const promptedAgents = buildPromptedAgents(
      mode === 'discover' ? FRONTIER_AGENTS : AGENTS,
      customPrompt
    );

    if (mode === 'replicate') {
      pipelineRef.current = runAgentPipeline(promptedAgents, [selectedPaper], callbacks);
    } else {
      pipelineRef.current = runAgentPipeline(promptedAgents, papersForPipeline, callbacks);
    }
    await pipelineRef.current;
  }, [mode, selectedPaper, selectedPapers, pipelineRunning, activeAgents, updateAgent, customPrompt]);

  // Determine if we have a valid selection
  const hasSelection = (mode === 'discover' || mode === 'ralph') ? selectedPapers.length > 0 : !!selectedPaper;

  // Button text
  const getButtonText = () => {
    if (pipelineRunning) return 'Running...';
    if (mode === 'replicate') return 'Replicate This Paper';
    if (selectedPapers.length > 1) return `Synthesize Frontiers (${selectedPapers.length} papers)`;
    return 'Discover Frontiers';
  };

  return (
    <div className="lab-container">
      {/* Left panel */}
      <div className="lab-sidebar">
        <div className="lab-sidebar-header">
          <h3>Select {(mode === 'discover' || mode === 'ralph') ? 'Papers' : 'a Paper'}</h3>
          {(mode === 'discover' || mode === 'ralph') && selectedPapers.length > 0 && (
            <span className="lab-paper-count-badge">{selectedPapers.length}/5</span>
          )}
        </div>

        {/* Source toggle: Papers | Problems */}
        <div className="lab-source-toggle">
          <button
            className={`lab-source-btn ${paperSource === 'papers' ? 'lab-source-active' : ''}`}
            onClick={() => setPaperSource('papers')}
          >
            Papers
          </button>
          <button
            className={`lab-source-btn ${paperSource === 'problems' ? 'lab-source-active' : ''}`}
            onClick={() => setPaperSource('problems')}
          >
            Problems
          </button>
        </div>

        {/* Add Custom Paper button (only in Papers mode) */}
        {paperSource === 'papers' && (
          <button
            className="lab-add-custom-btn"
            onClick={() => setShowCustomForm(!showCustomForm)}
          >
            {showCustomForm ? 'Cancel' : '+ Add Custom Paper'}
          </button>
        )}

        {/* Custom Paper Form */}
        {showCustomForm && paperSource === 'papers' && (
          <div className="lab-custom-form">
            <input
              className="lab-custom-input"
              type="text"
              placeholder="Title *"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />
            <input
              className="lab-custom-input"
              type="text"
              placeholder="Authors (comma-separated)"
              value={formAuthors}
              onChange={(e) => setFormAuthors(e.target.value)}
            />
            <input
              className="lab-custom-input"
              type="text"
              placeholder="Year"
              value={formYear}
              onChange={(e) => setFormYear(e.target.value)}
            />
            <textarea
              className="lab-custom-textarea"
              placeholder="Abstract / Content *"
              value={formAbstract}
              onChange={(e) => setFormAbstract(e.target.value)}
              rows={5}
            />
            <input
              className="lab-custom-input"
              type="text"
              placeholder="Fields (comma-separated)"
              value={formFields}
              onChange={(e) => setFormFields(e.target.value)}
            />
            <div className="lab-custom-actions">
              <button
                className="lab-upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload .txt
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.text"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <button
                className="btn btn-primary lab-custom-add-btn"
                onClick={handleAddCustomPaper}
                disabled={!formTitle.trim() || !formAbstract.trim()}
              >
                Add Paper
              </button>
            </div>
          </div>
        )}

        <input
          type="text"
          className="lab-search"
          placeholder={paperSource === 'problems' ? 'Search problems...' : 'Search papers...'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="lab-paper-list">
          {filteredPapers.map(p => {
            const isMultiSelect = mode === 'discover' || mode === 'ralph';
            const isSelected = isMultiSelect
              ? selectedPapers.some(sp => sp.id === p.id)
              : selectedPaper?.id === p.id;

            return (
              <div
                key={p.id}
                className={`lab-paper-item ${isSelected ? 'lab-paper-selected' : ''} ${p.source === 'custom' ? 'lab-paper-custom' : ''} ${p.source === 'problem' ? 'lab-paper-problem' : ''}`}
                onClick={() => {
                  if (isMultiSelect) {
                    togglePaperSelection(p);
                  } else {
                    selectPaper(p);
                  }
                }}
              >
                {isMultiSelect && (
                  <input
                    type="checkbox"
                    className="lab-paper-checkbox"
                    checked={isSelected}
                    readOnly
                  />
                )}
                <div style={{ flex: 1 }}>
                  <span className="lab-paper-title">
                    {p.source === 'custom' && <span className="lab-custom-badge">CUSTOM</span>}
                    {p.source === 'problem' && <span className="lab-problem-badge">PROBLEM</span>}
                    {p.title}
                  </span>
                  <span className="lab-paper-meta">{p.year} &middot; {(p.citationCount || 0).toLocaleString()} cites</span>
                </div>
                {p.source === 'custom' && (
                  <button
                    className="lab-custom-remove"
                    onClick={(e) => { e.stopPropagation(); handleRemoveCustomPaper(p.id); }}
                    title="Remove custom paper"
                  >&times;</button>
                )}
              </div>
            );
          })}
          {filteredPapers.length === 0 && (
            <div className="lab-no-results">No {paperSource === 'problems' ? 'problems' : 'papers'} match your search.</div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="lab-main">
        {/* Mode toggle */}
        <div className="lab-mode-toggle">
          <button
            className={`lab-mode-btn ${mode === 'replicate' ? 'lab-mode-active' : ''}`}
            onClick={() => handleModeSwitch('replicate')}
          >
            Replicate
          </button>
          <button
            className={`lab-mode-btn lab-mode-discover ${mode === 'discover' ? 'lab-mode-active' : ''}`}
            onClick={() => handleModeSwitch('discover')}
          >
            Discover
          </button>
          <button
            className={`lab-mode-btn lab-mode-ralph ${mode === 'ralph' ? 'lab-mode-active' : ''}`}
            onClick={() => handleModeSwitch('ralph')}
          >
            RALPH
          </button>
        </div>

        {mode === 'ralph' ? (
          <RALPHMode seedPapers={selectedPapers} hasApiKey={hasApiKey} />
        ) : !hasSelection ? (
          <div className="lab-empty">
            <div className="lab-empty-icon">{mode === 'discover' ? '\uD83D\uDD2D' : '\uD83E\uDDEA'}</div>
            <h2>AI Research Lab</h2>
            {mode === 'discover' ? (
              <>
                <p>Select 1-5 papers from the left panel to discover research frontiers.</p>
                <p className="lab-empty-sub">A team of 5 AI agents will find gaps, generate novel hypotheses, discover cross-field connections, and design experiments.</p>
              </>
            ) : (
              <>
                <p>Select a paper from the left panel to begin autonomous replication analysis.</p>
                <p className="lab-empty-sub">A team of 5 AI agents will analyze the paper, design a replication plan, simulate results, peer-review, and compile a report.</p>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Paper header */}
            <div className="lab-paper-header">
              <div>
                {mode === 'discover' && selectedPapers.length > 1 ? (
                  <div className="lab-multi-header">
                    <h2 className="lab-paper-selected-title">Frontier Discovery</h2>
                    <div className="lab-selected-chips">
                      {selectedPapers.map(p => (
                        <span key={p.id} className="lab-paper-chip">
                          {p.title.length > 40 ? p.title.slice(0, 40) + '...' : p.title}
                          <button
                            className="lab-chip-remove"
                            onClick={(e) => { e.stopPropagation(); togglePaperSelection(p); }}
                          >&times;</button>
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="lab-paper-selected-title">
                      {mode === 'discover' ? selectedPapers[0]?.title : selectedPaper?.title}
                    </h2>
                    <p className="lab-paper-selected-meta">
                      {(() => {
                        const p = mode === 'discover' ? selectedPapers[0] : selectedPaper;
                        if (!p) return '';
                        const authors = (p.authors || []).slice(0, 3).map(a => typeof a === 'string' ? a : a.name).join(', ');
                        return `${authors}${(p.authors || []).length > 3 ? ' et al.' : ''} \u00B7 ${p.year}`;
                      })()}
                    </p>
                  </>
                )}
              </div>
              {!hasApiKey ? (
                <div className="lab-no-key">
                  Set up an API key in the Research Navigator first.
                </div>
              ) : (
                <div className="lab-run-area">
                  {/* Custom prompt */}
                  <div className="lab-custom-prompt">
                    <label className="lab-custom-prompt-label">Custom Instructions (optional)</label>
                    <textarea
                      className="lab-custom-prompt-input"
                      placeholder="e.g. Focus on the methodology gaps, compare with reinforcement learning approaches, explore connections to algebraic geometry..."
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      rows={2}
                      disabled={pipelineRunning}
                    />
                  </div>
                  <button
                    className="btn btn-primary lab-run-btn"
                    onClick={startPipeline}
                    disabled={pipelineRunning}
                  >
                    {getButtonText()}
                  </button>
                </div>
              )}
            </div>

            {/* Pipeline visualization */}
            <div className="lab-pipeline">
              <div className="lab-pipeline-flow">
                {activeAgents.map((agent, i) => (
                  <React.Fragment key={agent.id}>
                    {i > 0 && <div className={`lab-pipeline-arrow ${
                      agentStates[agent.id]?.status !== 'pending' ? 'lab-arrow-active' : ''
                    }`}>{'\u2192'}</div>}
                    <div className={`lab-pipeline-node ${
                      agentStates[agent.id]?.status === 'working' ? 'lab-node-active' :
                      agentStates[agent.id]?.status === 'complete' ? 'lab-node-done' :
                      agentStates[agent.id]?.status === 'error' ? 'lab-node-error' : ''
                    }`} style={{ borderColor: agent.color }}>
                      <span>{agent.emoji}</span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Agent cards */}
            <div className="lab-agents">
              {activeAgents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  status={agentStates[agent.id]?.status || 'pending'}
                  output={agentStates[agent.id]?.output}
                  duration={agentStates[agent.id]?.duration}
                  error={agentStates[agent.id]?.error}
                />
              ))}
            </div>

            {/* Final report */}
            {finalReport && mode === 'replicate' && <ReplicationReport report={finalReport} />}
            {finalReport && mode === 'discover' && <FrontierReport report={finalReport} />}
          </>
        )}
      </div>
    </div>
  );
}

export default AIResearchLab;
