import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GRAPH_COLORS } from '../config';
import { loadInitialGraph, searchPapers, buildGraphFromPapers, mergeOnChainPapers } from '../utils/semanticScholar';
import { bulkFetchPapers } from '../utils/bulkImport';
import PaperDetail from './PaperDetail';
import GNNPredictor from './GNNPredictor';
import ResearchAgent from './ResearchAgent';
import { findCitationPath } from '../utils/ragRetrieval';

// Field-based color mapping — covers both Semantic Scholar and OpenAlex field names
const FIELD_COLORS = {
  'Computer Science': '#4A90D9',
  'Artificial Intelligence': '#4A90D9',
  'Biology': '#48BB78',
  'Biochemistry, Genetics and Molecular Biology': '#48BB78',
  'Agricultural and Biological Sciences': '#48BB78',
  'Medicine': '#38A169',
  'Immunology and Microbiology': '#38A169',
  'Pharmacology, Toxicology and Pharmaceutics': '#38A169',
  'Physics': '#ECC94B',
  'Physics and Astronomy': '#ECC94B',
  'Materials Science': '#D69E2E',
  'Chemistry': '#DD6B20',
  'Chemical Engineering': '#DD6B20',
  'Neuroscience': '#E53E3E',
  'Mathematics': '#9F7AEA',
  'Engineering': '#667EEA',
  'Electrical and Electronic Engineering': '#667EEA',
  'Environmental Science': '#319795',
  'Earth and Planetary Sciences': '#319795',
  'Psychology': '#D53F8C',
  'Economics, Econometrics and Finance': '#B794F4',
  'Other': '#A0AEC0',
};

// Collapse to display categories for legend/filter
const FIELD_DISPLAY = {
  'Computer Science': '#4A90D9',
  'Biology & Medicine': '#48BB78',
  'Physics': '#ECC94B',
  'Chemistry & Materials': '#DD6B20',
  'Neuroscience': '#E53E3E',
  'Math & Engineering': '#9F7AEA',
  'Earth & Environment': '#319795',
  'Other': '#A0AEC0',
};

// Map any field name to a display category
function fieldToCategory(fieldName) {
  if (!fieldName) return 'Other';
  const lower = fieldName.toLowerCase();
  if (lower.includes('computer') || lower.includes('artificial intelligence') || lower.includes('informatics')) return 'Computer Science';
  if (lower.includes('biolog') || lower.includes('biochem') || lower.includes('genetic') || lower.includes('molecul') || lower.includes('medicin') || lower.includes('immun') || lower.includes('pharm') || lower.includes('health') || lower.includes('clinical')) return 'Biology & Medicine';
  if (lower.includes('physic') || lower.includes('astron')) return 'Physics';
  if (lower.includes('chemi') || lower.includes('material')) return 'Chemistry & Materials';
  if (lower.includes('neuro') || lower.includes('brain') || lower.includes('cognit')) return 'Neuroscience';
  if (lower.includes('math') || lower.includes('engineer') || lower.includes('electr')) return 'Math & Engineering';
  if (lower.includes('environ') || lower.includes('earth') || lower.includes('climate') || lower.includes('ecolog')) return 'Earth & Environment';
  if (lower.includes('psychol')) return 'Other';
  return 'Other';
}

function getFieldColor(node) {
  if (!node.fieldsOfStudy || node.fieldsOfStudy.length === 0) return FIELD_DISPLAY['Other'];
  const primary = node.fieldsOfStudy[0];
  // Try direct match first
  if (FIELD_COLORS[primary]) return FIELD_COLORS[primary];
  // Fall back to category mapping
  const cat = fieldToCategory(primary);
  return FIELD_DISPLAY[cat] || FIELD_DISPLAY['Other'];
}

function KnowledgeGraph({ contracts, account, onImportPaper, onMakeRunnable, onReplicate }) {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, onChain: 0, external: 0 });
  const [filters, setFilters] = useState({
    showExternal: true,
    showOnChain: true,
    minCitations: 0,
    maxCitations: 200000,
    yearRange: [1990, 2026],
    fields: new Set(Object.keys(FIELD_DISPLAY)),
  });
  const [colorByField, setColorByField] = useState(false);
  const fgRef = useRef();
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // GNN state
  const [showGNNPanel, setShowGNNPanel] = useState(false);
  const [predictedLinks, setPredictedLinks] = useState(null);
  const [showPredictedLinks, setShowPredictedLinks] = useState(false);

  // Bulk import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);

  // Research Agent state
  const [showAgent, setShowAgent] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const [pathIds, setPathIds] = useState(new Set());

  // Time animation state
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(false);

  // Resize handler
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: Math.max(500, window.innerHeight - 300),
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Load initial graph
  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      const data = await loadInitialGraph();
      if (!cancelled) {
        setGraphData(data);
        setLoading(false);
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // Merge on-chain papers
  useEffect(() => {
    if (!contracts.researchGraph || graphData.nodes.length === 0) return;
    let cancelled = false;

    async function loadOnChain() {
      try {
        const count = await contracts.researchGraph.paperCount();
        const papers = [];
        for (let i = 1; i <= Math.min(Number(count), 50); i++) {
          try {
            const paper = await contracts.researchGraph.getPaper(i);
            papers.push({
              id: Number(paper.id),
              author: paper.author,
              ipfsHash: paper.ipfsHash,
              doi: paper.doi,
              status: Number(paper.status),
              timestamp: Number(paper.timestamp),
              citationCount: Number(paper.citationCount),
            });
          } catch (e) {
            // Paper might not exist
          }
        }
        if (!cancelled && papers.length > 0) {
          setGraphData(prev => mergeOnChainPapers(prev, papers, account));
        }
      } catch (e) {
        console.log('Could not load on-chain papers:', e.message);
      }
    }
    loadOnChain();
    return () => { cancelled = true; };
  }, [contracts.researchGraph, account, graphData.nodes.length]);

  // Update stats when graph changes
  useEffect(() => {
    const onChain = graphData.nodes.filter(n => n.onChain).length;
    setStats({
      total: graphData.nodes.length,
      onChain,
      external: graphData.nodes.length - onChain,
    });
  }, [graphData.nodes]);

  // Search handler
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const results = await searchPapers(searchQuery.trim());
      if (results.length > 0) {
        setGraphData(prev => buildGraphFromPapers(results, prev));
      }
    } catch (err) {
      console.error('Search error:', err);
    }
    setSearching(false);
  }, [searchQuery]);

  // Bulk import handler
  const handleBulkImport = useCallback(async () => {
    setImporting(true);
    setImportProgress({ phase: 'starting', total: 0 });
    try {
      const { papers, citations } = await bulkFetchPapers(undefined, (progress) => {
        setImportProgress(progress);
      });
      if (papers.length > 0) {
        setGraphData(prev => {
          const nodeMap = new Map();
          prev.nodes.forEach(n => nodeMap.set(n.id, n));
          papers.forEach(p => {
            if (!nodeMap.has(p.id)) nodeMap.set(p.id, p);
          });
          const linkSet = new Set();
          const existingLinks = [];
          prev.links.forEach(l => {
            const src = typeof l.source === 'object' ? l.source.id : l.source;
            const tgt = typeof l.target === 'object' ? l.target.id : l.target;
            linkSet.add(`${src}->${tgt}`);
            existingLinks.push(l);
          });
          const nodeIds = new Set(nodeMap.keys());
          citations.forEach(c => {
            const key = `${c.source}->${c.target}`;
            if (!linkSet.has(key) && nodeIds.has(c.source) && nodeIds.has(c.target)) {
              linkSet.add(key);
              existingLinks.push(c);
            }
          });
          return { nodes: Array.from(nodeMap.values()), links: existingLinks };
        });
      }
    } catch (err) {
      console.error('Bulk import error:', err);
    }
    setImporting(false);
    setImportProgress(null);
  }, []);

  // Time animation
  useEffect(() => {
    if (!playing) return;
    playRef.current = true;
    let year = filters.yearRange[0];
    const maxYear = 2026;

    const interval = setInterval(() => {
      if (!playRef.current || year >= maxYear) {
        setPlaying(false);
        playRef.current = false;
        clearInterval(interval);
        return;
      }
      year++;
      setFilters(f => ({ ...f, yearRange: [f.yearRange[0], year] }));
    }, 200);

    return () => {
      playRef.current = false;
      clearInterval(interval);
    };
  }, [playing, filters.yearRange]);

  // Configure force for predicted links
  useEffect(() => {
    if (fgRef.current) {
      const linkForce = fgRef.current.d3Force('link');
      if (linkForce) {
        linkForce.strength(link => link.predicted ? 0 : 1);
      }
    }
  }, [predictedLinks, showPredictedLinks]);

  // Handle GNN predictions
  const handlePredictions = useCallback((preds) => {
    setPredictedLinks(preds);
    setShowPredictedLinks(!!preds);
  }, []);

  // Handle graph actions from Research Agent
  const handleGraphAction = useCallback((action) => {
    if (!action) return;

    if (action.type === 'highlight') {
      setHighlightedIds(new Set(action.ids));
      setPathIds(new Set());
      // Auto-clear highlight after 10s
      setTimeout(() => setHighlightedIds(new Set()), 10000);
    }

    if (action.type === 'zoom') {
      const node = graphData.nodes.find(n => n.id === action.id);
      if (node && fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 800);
        fgRef.current.zoom(4, 800);
        setHighlightedIds(new Set([action.id]));
        setTimeout(() => setHighlightedIds(new Set()), 10000);
      }
    }

    if (action.type === 'path') {
      const path = action.ids || findCitationPath(action.from, action.to, graphData);
      if (path && path.length > 0) {
        setPathIds(new Set(path));
        setHighlightedIds(new Set(path));
        // Zoom to fit path
        if (fgRef.current && path.length > 0) {
          const firstNode = graphData.nodes.find(n => n.id === path[0]);
          if (firstNode) {
            fgRef.current.centerAt(firstNode.x, firstNode.y, 800);
            fgRef.current.zoom(2, 800);
          }
        }
        setTimeout(() => {
          setPathIds(new Set());
          setHighlightedIds(new Set());
        }, 15000);
      }
    }
  }, [graphData]);

  // Compute year bounds from data
  const yearBounds = useMemo(() => {
    const years = graphData.nodes.map(n => n.year).filter(Boolean);
    if (years.length === 0) return { min: 1990, max: 2026 };
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [graphData.nodes]);

  // Compute max citation count from data
  const maxCitationInData = useMemo(() => {
    return Math.max(...graphData.nodes.map(n => n.citationCount || 0), 1000);
  }, [graphData.nodes]);

  // Filter graph data
  const filteredData = useMemo(() => {
    const filteredNodes = graphData.nodes.filter(node => {
      if (!filters.showExternal && !node.onChain) return false;
      if (!filters.showOnChain && node.onChain) return false;
      if ((node.citationCount || 0) < filters.minCitations) return false;
      if ((node.citationCount || 0) > filters.maxCitations) return false;
      if (node.year && (node.year < filters.yearRange[0] || node.year > filters.yearRange[1])) return false;
      // Field filter
      if (colorByField) {
        const primary = (node.fieldsOfStudy && node.fieldsOfStudy[0]) || '';
        const cat = fieldToCategory(primary);
        if (!filters.fields.has(cat)) return false;
      }
      return true;
    });

    const nodeIds = new Set(filteredNodes.map(n => n.id));

    // Real links
    const filteredLinks = graphData.links.filter(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      return nodeIds.has(sourceId) && nodeIds.has(targetId);
    });

    // Merge predicted links if enabled
    if (showPredictedLinks && predictedLinks) {
      predictedLinks.forEach(pred => {
        if (nodeIds.has(pred.source) && nodeIds.has(pred.target)) {
          filteredLinks.push({
            source: pred.source,
            target: pred.target,
            predicted: true,
            score: pred.score,
          });
        }
      });
    }

    return { nodes: filteredNodes, links: filteredLinks };
  }, [graphData, filters, showPredictedLinks, predictedLinks, colorByField]);

  // Node color
  const getNodeColor = useCallback((node) => {
    if (colorByField) return getFieldColor(node);
    if (node.isUserPaper) return GRAPH_COLORS.USER;
    if (node.onChain) return GRAPH_COLORS.ONCHAIN;
    return GRAPH_COLORS.EXTERNAL;
  }, [colorByField]);

  // Custom node rendering
  const paintNode = useCallback((node, ctx, globalScale) => {
    const label = node.title?.length > 30 ? node.title.slice(0, 28) + '...' : node.title;
    const fontSize = Math.max(10 / globalScale, 2);
    const isHighlighted = highlightedIds.has(node.id);
    const isOnPath = pathIds.has(node.id);
    const nodeR = isHighlighted ? Math.max(node.val || 3, 2) * 1.5 : Math.max(node.val || 3, 2);
    const color = isOnPath ? '#f6e05e' : isHighlighted ? '#f56565' : getNodeColor(node);

    // Glow effect
    ctx.shadowColor = color;
    ctx.shadowBlur = isHighlighted ? 20 : 8;

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeR, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.shadowBlur = 0;

    // Highlight ring
    if (isHighlighted) {
      ctx.strokeStyle = isOnPath ? '#f6e05e' : '#f56565';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Border for on-chain
    if (node.onChain && !isHighlighted) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    // Code indicator for papers with repos
    if (node.githubRepo) {
      ctx.font = `${Math.max(8 / globalScale, 3)}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText('\u{2022}', node.x + nodeR + 3 / globalScale, node.y - nodeR);
      // small bracket icon
      ctx.font = `bold ${Math.max(7 / globalScale, 2.5)}px monospace`;
      ctx.fillStyle = '#a78bfa';
      ctx.fillText('{ }', node.x + nodeR + 3 / globalScale, node.y - nodeR);
    }

    // Label (when zoomed in OR highlighted)
    if (globalScale > 1.5 || isHighlighted) {
      ctx.font = `${isHighlighted ? Math.max(fontSize, 4) : fontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isHighlighted ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.85)';
      ctx.fillText(label, node.x, node.y + nodeR + 2);
    }
  }, [getNodeColor, highlightedIds, pathIds]);

  // Custom link rendering for predicted links
  const paintLink = useCallback((link, ctx) => {
    if (!link.predicted) return; // let default handle normal links

    const start = link.source;
    const end = link.target;
    if (!start.x || !end.x) return;

    ctx.save();
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
  }, []);

  // Node click handler
  const handleNodeClick = useCallback((node) => {
    setSelectedPaper(node);
    if (fgRef.current) {
      fgRef.current.centerAt(node.x, node.y, 500);
      fgRef.current.zoom(3, 500);
    }
  }, []);

  // Import handler
  const handleImport = useCallback((paper) => {
    setSelectedPaper(null);
    if (onImportPaper) {
      onImportPaper({
        title: paper.title,
        abstract: paper.abstract || '',
        doi: paper.doi || '',
        authors: paper.authors,
      });
    }
  }, [onImportPaper]);

  // Toggle a field in the filter
  const toggleField = useCallback((field) => {
    setFilters(f => {
      const newFields = new Set(f.fields);
      if (newFields.has(field)) newFields.delete(field);
      else newFields.add(field);
      return { ...f, fields: newFields };
    });
  }, []);

  return (
    <div className="knowledge-graph-container">
      {/* Search Bar */}
      <form className="graph-search" onSubmit={handleSearch}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search papers (e.g., BERT, diffusion models, reinforcement learning)..."
          className="graph-search-input"
        />
        <button type="submit" className="btn btn-primary graph-search-btn" disabled={searching}>
          {searching ? 'Searching...' : 'Search'}
        </button>
      </form>

      {/* Filters */}
      <div className="graph-filters">
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={filters.showExternal}
            onChange={(e) => setFilters(f => ({ ...f, showExternal: e.target.checked }))}
          />
          <span style={{ color: GRAPH_COLORS.EXTERNAL }}>External Papers</span>
        </label>
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={filters.showOnChain}
            onChange={(e) => setFilters(f => ({ ...f, showOnChain: e.target.checked }))}
          />
          <span style={{ color: GRAPH_COLORS.ONCHAIN }}>On-Chain Papers</span>
        </label>

        <div className="filter-slider">
          <span>Min Citations: {filters.minCitations.toLocaleString()}</span>
          <input
            type="range"
            min="0"
            max={maxCitationInData}
            step="1000"
            value={filters.minCitations}
            onChange={(e) => setFilters(f => ({ ...f, minCitations: Number(e.target.value) }))}
          />
        </div>
        <div className="filter-slider">
          <span>Max Citations: {filters.maxCitations.toLocaleString()}</span>
          <input
            type="range"
            min="0"
            max={maxCitationInData}
            step="1000"
            value={filters.maxCitations}
            onChange={(e) => setFilters(f => ({ ...f, maxCitations: Number(e.target.value) }))}
          />
        </div>
      </div>

      {/* Time Slider */}
      <div className="graph-time-slider">
        <div className="time-slider-row">
          <button
            className="time-play-btn"
            onClick={() => {
              if (playing) {
                setPlaying(false);
              } else {
                setFilters(f => ({ ...f, yearRange: [f.yearRange[0], f.yearRange[0]] }));
                setTimeout(() => setPlaying(true), 50);
              }
            }}
            title={playing ? 'Pause' : 'Play animation'}
          >
            {playing ? '\u23F8' : '\u25B6'}
          </button>
          <div className="time-slider-labels">
            <span>{filters.yearRange[0]}</span>
            <span>to</span>
            <span>{filters.yearRange[1]}</span>
          </div>
          <div className="time-slider-inputs">
            <input
              type="range"
              min={yearBounds.min}
              max={yearBounds.max}
              value={filters.yearRange[0]}
              onChange={(e) => setFilters(f => ({
                ...f,
                yearRange: [Math.min(Number(e.target.value), f.yearRange[1]), f.yearRange[1]],
              }))}
              className="time-range-input"
            />
            <input
              type="range"
              min={yearBounds.min}
              max={yearBounds.max}
              value={filters.yearRange[1]}
              onChange={(e) => setFilters(f => ({
                ...f,
                yearRange: [f.yearRange[0], Math.max(Number(e.target.value), f.yearRange[0])],
              }))}
              className="time-range-input"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="graph-actions-bar">
        <button
          className={`graph-action-btn gnn-btn ${showGNNPanel ? 'active' : ''}`}
          onClick={() => setShowGNNPanel(!showGNNPanel)}
        >
          &#x1F9E0; GNN Link Prediction
        </button>
        <button
          className="graph-action-btn import-btn"
          onClick={handleBulkImport}
          disabled={importing}
        >
          {importing
            ? importProgress?.phase === 'fetching'
              ? `${importProgress.field} (${importProgress.total.toLocaleString()} papers...)`
              : importProgress?.phase === 'building_edges'
                ? `Building citation graph (${importProgress.total.toLocaleString()} papers)...`
                : 'Starting import...'
            : `\u{1F4E5} Import ~5,000 Papers (OpenAlex)`}
        </button>
        <label className="filter-toggle field-color-toggle">
          <input
            type="checkbox"
            checked={colorByField}
            onChange={(e) => setColorByField(e.target.checked)}
          />
          <span>Color by field</span>
        </label>
        <button
          className={`graph-action-btn agent-btn ${showAgent ? 'active' : ''}`}
          onClick={() => setShowAgent(!showAgent)}
        >
          &#x1F9ED; Research Navigator
        </button>
      </div>

      {/* Field Filter Checkboxes (shown when color by field is active) */}
      {colorByField && (
        <div className="graph-field-filters">
          {Object.entries(FIELD_DISPLAY).map(([field, color]) => (
            <label key={field} className="filter-toggle">
              <input
                type="checkbox"
                checked={filters.fields.has(field)}
                onChange={() => toggleField(field)}
              />
              <span style={{ color }}>{field}</span>
            </label>
          ))}
        </div>
      )}

      {/* GNN Panel */}
      {showGNNPanel && (
        <GNNPredictor
          graphData={graphData}
          onPredictionsReady={handlePredictions}
        />
      )}

      {/* Graph */}
      <div className="graph-canvas" ref={containerRef}>
        {loading ? (
          <div className="graph-loading">
            <div className="graph-loading-spinner" />
            <p>Loading knowledge graph...</p>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={filteredData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor={GRAPH_COLORS.BACKGROUND}
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node, color, ctx) => {
              const r = Math.max(node.val || 3, 5);
              ctx.beginPath();
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = color;
              ctx.fill();
            }}
            linkCanvasObjectMode={(link) => link.predicted ? 'replace' : undefined}
            linkCanvasObject={paintLink}
            linkColor={(link) => link.predicted ? '#a855f7' : GRAPH_COLORS.EDGE}
            linkWidth={(link) => link.predicted ? 1.5 : 0.5}
            linkDirectionalArrowLength={(link) => link.predicted ? 0 : (filteredData.nodes.length > 500 ? 0 : 3)}
            linkDirectionalArrowRelPos={1}
            onNodeClick={handleNodeClick}
            cooldownTicks={filteredData.nodes.length > 500 ? 50 : 100}
            d3AlphaDecay={filteredData.nodes.length > 500 ? 0.05 : 0.02}
            d3VelocityDecay={filteredData.nodes.length > 500 ? 0.4 : 0.3}
            warmupTicks={filteredData.nodes.length > 1000 ? 50 : 0}
            nodeLabel={node => `${node.title} (${(node.citationCount || 0).toLocaleString()} citations)`}
          />
        )}

        {/* Legend */}
        <div className="graph-legend">
          {colorByField ? (
            <>
              {Object.entries(FIELD_DISPLAY).map(([field, color]) => (
                <div key={field} className="legend-item">
                  <span className="legend-dot" style={{ background: color }} />
                  {field}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: GRAPH_COLORS.EXTERNAL }} />
                External ({stats.external})
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: GRAPH_COLORS.ONCHAIN }} />
                On-Chain ({stats.onChain})
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: GRAPH_COLORS.USER }} />
                Your Papers
              </div>
            </>
          )}
          {showPredictedLinks && predictedLinks && (
            <>
              <div className="legend-divider" />
              <div className="legend-item">
                <span className="legend-line-dashed" />
                Predicted ({predictedLinks.length})
              </div>
            </>
          )}
          <div className="legend-divider" />
          <div className="legend-item legend-stat">
            {stats.total} papers &middot; {filteredData.links.filter(l => !l.predicted).length} citations
          </div>
        </div>
      </div>

      {/* Research Agent Sidebar */}
      {showAgent && (
        <div className="ra-overlay">
          <ResearchAgent
            graphData={graphData}
            onGraphAction={handleGraphAction}
            onClose={() => setShowAgent(false)}
          />
        </div>
      )}

      {/* Paper Detail Sidebar */}
      <PaperDetail
        paper={selectedPaper}
        onClose={() => setSelectedPaper(null)}
        onImport={handleImport}
        onMakeRunnable={(paper) => {
          setSelectedPaper(null);
          if (onMakeRunnable) onMakeRunnable(paper);
        }}
        onReplicate={(paper) => {
          setSelectedPaper(null);
          if (onReplicate) onReplicate(paper);
        }}
      />
    </div>
  );
}

export default KnowledgeGraph;
