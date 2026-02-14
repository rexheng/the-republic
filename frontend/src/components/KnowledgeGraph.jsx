import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { GRAPH_COLORS } from '../config';
import { searchPapers, buildGraphFromPapers, mergeOnChainPapers } from '../utils/semanticScholar';
import PaperDetail from './PaperDetail';
import GNNPredictor from './GNNPredictor';
import ResearchAgent from './ResearchAgent';
import AddPapersPanel from './AddPapersPanel';
import { findCitationPath, searchByKeywords } from '../utils/ragRetrieval';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FadeIn } from '@/components/ui/fade-in';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Play, Pause, BrainCircuit, Plus, Compass, Download, ChevronDown, ChevronUp, SlidersHorizontal, X, List, LayoutGrid, Trash2 } from 'lucide-react';
import PaperListView from './PaperListView';

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
  'Economics': '#B794F4',
  'Economics, Econometrics and Finance': '#B794F4',
  'Business, Management and Accounting': '#B794F4',
  'Political Science': '#F687B3',
  'Law': '#F687B3',
  'Sociology': '#D53F8C',
  'Social Sciences': '#D53F8C',
  'Psychology': '#D53F8C',
  'Philosophy': '#D53F8C',
  'Arts and Humanities': '#D53F8C',
  'History': '#D53F8C',
  'Linguistics and Language': '#D53F8C',
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
  'Economics & Finance': '#B794F4',
  'Political Science & Law': '#F687B3',
  'Social Sciences': '#D53F8C',
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
  if (lower.includes('econom') || lower.includes('financ') || lower.includes('account') || lower.includes('business') || lower.includes('management')) return 'Economics & Finance';
  if (lower.includes('politi') || lower.includes('law') || lower.includes('legal') || lower.includes('govern')) return 'Political Science & Law';
  if (lower.includes('sociol') || lower.includes('social') || lower.includes('psychol') || lower.includes('philos') || lower.includes('human') || lower.includes('arts') || lower.includes('histor') || lower.includes('linguist') || lower.includes('anthropol')) return 'Social Sciences';
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

function KnowledgeGraph({ contracts, account, graphData, setGraphData, onImportPaper, onMakeRunnable, onReplicate }) {
  const [selectedPaper, setSelectedPaper] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const loading = graphData.nodes.length === 0;
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
  const outerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 800, height: typeof window !== 'undefined' ? window.innerHeight - 150 : 600 });

  // GNN state
  const [showGNNPanel, setShowGNNPanel] = useState(false);
  const [predictedLinks, setPredictedLinks] = useState(null);
  const [showPredictedLinks, setShowPredictedLinks] = useState(false);

  // Add Papers panel state
  const [showAddPanel, setShowAddPanel] = useState(false);
  const addBtnRef = useRef(null);

  // Research Agent state
  const [showAgent, setShowAgent] = useState(false);
  const [highlightedIds, setHighlightedIds] = useState(new Set());
  const [pathIds, setPathIds] = useState(new Set());

  // Spawn animation state — newly added paper nodes
  const [spawnIds, setSpawnIds] = useState(new Set());
  const spawnTimers = useRef(new Map());

  // View mode: 'graph' or 'list'
  const [viewMode, setViewMode] = useState('graph');

  // Controls collapsed state
  const [showControls, setShowControls] = useState(false);

  // Manage papers state
  const [fieldsToRemove, setFieldsToRemove] = useState(new Set());
  const [sourcesToRemove, setSourcesToRemove] = useState(new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [confirmRemoveAll, setConfirmRemoveAll] = useState(false);

  // Time animation state
  const [playing, setPlaying] = useState(false);
  const playRef = useRef(false);

  // Resize handler — measures actual container size
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight || 400,
        });
      }
    };
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    // Also re-measure when controls or agent panel toggle
    const raf = requestAnimationFrame(updateDimensions);
    const timer = setTimeout(updateDimensions, 100);
    return () => {
      window.removeEventListener('resize', updateDimensions);
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [showControls, showGNNPanel]);

  // Dynamically compute container height from actual DOM position
  useEffect(() => {
    const measure = () => {
      if (outerRef.current) {
        const top = outerRef.current.getBoundingClientRect().top;
        outerRef.current.style.height = `calc(100vh - ${top}px)`;
      }
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Initial graph loaded by App.jsx — no need to load here

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
      } catch {
        // On-chain papers unavailable — expected when wallet not connected
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

  // Search handler — dual search (local graph + Semantic Scholar API) with highlighting
  const handleSearch = useCallback(async (e) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setSearching(true);
    const matchedIds = new Set();

    // Leg 1: Local search — match against papers already in the graph
    const localResults = searchByKeywords(query, graphData.nodes, 50);
    for (const { paper } of localResults) {
      matchedIds.add(paper.id);
    }

    // Leg 2: Semantic Scholar API — fetch new papers and merge into graph
    try {
      const apiResults = await searchPapers(query);
      if (apiResults.length > 0) {
        for (const paper of apiResults) {
          matchedIds.add(paper.id);
        }
        setGraphData(prev => buildGraphFromPapers(apiResults, prev));
      }
    } catch (err) {
      console.error('Search error:', err);
      // Local results still get highlighted even if API fails
    }

    // Apply highlights (always — clears stale highlights if nothing matched)
    setHighlightedIds(matchedIds);
    setPathIds(new Set());

    // Zoom to fit all highlighted nodes after a brief delay for force layout
    if (matchedIds.size > 0) {
      setTimeout(() => {
        if (fgRef.current) {
          fgRef.current.zoomToFit(400, 60, node => matchedIds.has(node.id));
        }
      }, 300);
    }

    setSearching(false);
  }, [searchQuery, graphData.nodes]);

  // Clear search results and highlights
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setHighlightedIds(new Set());
  }, []);

  // Add single paper (from PDF upload) — with spawn animation + auto-zoom
  const handleAddPaper = useCallback((paper) => {
    // Mark as spawning so paintNode renders the entrance animation
    const paperId = paper.id;
    const paperWithSpawn = { ...paper, _spawnTime: Date.now() };

    setGraphData(prev => ({
      nodes: [...prev.nodes, paperWithSpawn],
      links: prev.links,
    }));

    // Add to spawn set for animated rendering
    setSpawnIds(prev => new Set([...prev, paperId]));
    setHighlightedIds(new Set([paperId]));

    // After animation completes (2s), remove spawn state
    const timer = setTimeout(() => {
      setSpawnIds(prev => {
        const next = new Set(prev);
        next.delete(paperId);
        return next;
      });
    }, 2500);
    spawnTimers.current.set(paperId, timer);

    // Auto-clear highlight after 8s
    setTimeout(() => setHighlightedIds(prev => {
      const next = new Set(prev);
      next.delete(paperId);
      return next;
    }), 8000);

    // Zoom to the new node after a brief delay (let force layout place it)
    setTimeout(() => {
      const node = fgRef.current?.graphData?.().nodes?.find(n => n.id === paperId);
      if (node && fgRef.current) {
        fgRef.current.centerAt(node.x, node.y, 800);
        fgRef.current.zoom(3, 800);
      }
    }, 500);

    // Keep the simulation warm during animation so canvas repaints
    const reheat = () => {
      if (fgRef.current) {
        fgRef.current.d3ReheatSimulation();
      }
    };
    reheat();
    const reheatInterval = setInterval(reheat, 300);
    setTimeout(() => clearInterval(reheatInterval), 3000);
  }, []);

  // Import papers + citations from JSON or bulk sources
  const handleImportPapers = useCallback((papers, citations = []) => {
    if (!papers || papers.length === 0) return;

    let newCount = 0;

    setGraphData(prev => {
      const nodeMap = new Map();
      prev.nodes.forEach(n => nodeMap.set(n.id, n));
      papers.forEach(p => {
        if (!nodeMap.has(p.id)) {
          nodeMap.set(p.id, {
            ...p,
            paperId: p.paperId || p.id,
            val: p.val || Math.max(2, Math.log10((p.citationCount || 1) + 1) * 3),
            source: p.source || 'imported',
          });
          newCount++;
        }
      });
      const linkSet = new Set();
      const allLinks = [];
      prev.links.forEach(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        linkSet.add(`${src}->${tgt}`);
        allLinks.push(l);
      });
      const nodeIds = new Set(nodeMap.keys());
      citations.forEach(c => {
        const src = typeof c.source === 'object' ? c.source.id : c.source;
        const tgt = typeof c.target === 'object' ? c.target.id : c.target;
        const key = `${src}->${tgt}`;
        if (!linkSet.has(key) && nodeIds.has(src) && nodeIds.has(tgt)) {
          linkSet.add(key);
          allLinks.push({ source: src, target: tgt, predicted: c.predicted || false });
        }
      });
      return { nodes: Array.from(nodeMap.values()), links: allLinks };
    });

    // Reheat the force simulation so new nodes spread out properly
    setTimeout(() => {
      if (fgRef.current) {
        fgRef.current.d3ReheatSimulation();
        // Zoom to fit all nodes after a brief layout period
        setTimeout(() => {
          if (fgRef.current) {
            fgRef.current.zoomToFit(400, 40);
          }
        }, 600);
      }
    }, 100);

    // Fire-and-forget: persist new papers to the KG API
    if (newCount > 0) {
      try {
        fetch('/api/kg?action=bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ papers, citations }),
        }).catch(() => { /* API persistence is best-effort */ });
      } catch { /* ignore */ }
    }
  }, []);

  // Remove a single paper (and its links) from the graph
  const handleRemovePaper = useCallback((paperId) => {
    setGraphData(prev => ({
      nodes: prev.nodes.filter(n => n.id !== paperId),
      links: prev.links.filter(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        return src !== paperId && tgt !== paperId;
      }),
    }));
    if (selectedPaper?.id === paperId) setSelectedPaper(null);
  }, [selectedPaper]);

  // Compute field and source distributions for the Manage Papers panel
  const fieldDistribution = useMemo(() => {
    const counts = {};
    for (const node of graphData.nodes) {
      const field = node.fieldsOfStudy?.[0];
      const cat = fieldToCategory(field);
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [graphData.nodes]);

  const sourceDistribution = useMemo(() => {
    const counts = {};
    for (const node of graphData.nodes) {
      const src = node.source || 'unknown';
      counts[src] = (counts[src] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [graphData.nodes]);

  const stagedRemovalCount = useMemo(() => {
    if (fieldsToRemove.size === 0 && sourcesToRemove.size === 0) return 0;
    return graphData.nodes.filter(node => {
      const cat = fieldToCategory(node.fieldsOfStudy?.[0]);
      const src = node.source || 'unknown';
      return fieldsToRemove.has(cat) || sourcesToRemove.has(src);
    }).length;
  }, [graphData.nodes, fieldsToRemove, sourcesToRemove]);

  const handleBulkRemove = useCallback(() => {
    if (!confirmRemove) {
      setConfirmRemove(true);
      setTimeout(() => setConfirmRemove(false), 3000);
      return;
    }
    const idsToRemove = new Set();
    for (const node of graphData.nodes) {
      const cat = fieldToCategory(node.fieldsOfStudy?.[0]);
      const src = node.source || 'unknown';
      if (fieldsToRemove.has(cat) || sourcesToRemove.has(src)) {
        idsToRemove.add(node.id);
      }
    }
    setGraphData(prev => ({
      nodes: prev.nodes.filter(n => !idsToRemove.has(n.id)),
      links: prev.links.filter(l => {
        const s = typeof l.source === 'object' ? l.source.id : l.source;
        const t = typeof l.target === 'object' ? l.target.id : l.target;
        return !idsToRemove.has(s) && !idsToRemove.has(t);
      }),
    }));
    if (selectedPaper && idsToRemove.has(selectedPaper.id)) setSelectedPaper(null);
    setFieldsToRemove(new Set());
    setSourcesToRemove(new Set());
    setConfirmRemove(false);
  }, [graphData.nodes, fieldsToRemove, sourcesToRemove, confirmRemove, selectedPaper, setGraphData]);

  const handleRemoveAll = useCallback(() => {
    if (!confirmRemoveAll) {
      setConfirmRemoveAll(true);
      setTimeout(() => setConfirmRemoveAll(false), 3000);
      return;
    }
    setGraphData({ nodes: [], links: [] });
    setSelectedPaper(null);
    setConfirmRemoveAll(false);
    setFieldsToRemove(new Set());
    setSourcesToRemove(new Set());
  }, [confirmRemoveAll, setGraphData]);

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

  // Set of existing node IDs — passed to SamplesTab for duplicate detection
  const existingNodeIds = useMemo(() => {
    return new Set(graphData.nodes.map(n => n.id));
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
    const isSpawning = spawnIds.has(node.id);

    // Spawn animation: starts at 5x size and eases down to 1x over 2s
    let spawnScale = 1;
    if (isSpawning && node._spawnTime) {
      const elapsed = (Date.now() - node._spawnTime) / 1000; // seconds
      if (elapsed < 2) {
        // Elastic ease-out: overshoot then settle
        const t = Math.min(elapsed / 2, 1);
        spawnScale = 1 + 4 * Math.pow(1 - t, 2) * Math.cos(t * Math.PI * 2);
        spawnScale = Math.max(spawnScale, 1);
      }
    }

    const baseR = Math.max(node.val || 3, 2);
    const nodeR = (isHighlighted ? baseR * 1.5 : baseR) * spawnScale;
    const color = isSpawning ? '#22d3ee' : isOnPath ? '#f6e05e' : isHighlighted ? '#f56565' : getNodeColor(node);

    // Glow effect — extra glow for spawning nodes
    ctx.shadowColor = color;
    ctx.shadowBlur = isSpawning ? 30 * spawnScale : isHighlighted ? 20 : 8;

    // Node circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, nodeR, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.shadowBlur = 0;

    // Spawn pulse rings
    if (isSpawning && node._spawnTime) {
      const elapsed = (Date.now() - node._spawnTime) / 1000;
      if (elapsed < 2.5) {
        // Expanding ring
        const ringProgress = (elapsed % 0.8) / 0.8;
        const ringR = nodeR + (20 / globalScale) * ringProgress;
        const ringAlpha = 0.6 * (1 - ringProgress);
        ctx.beginPath();
        ctx.arc(node.x, node.y, ringR, 0, 2 * Math.PI);
        ctx.strokeStyle = `rgba(34, 211, 238, ${ringAlpha})`;
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }
    }

    // Highlight ring
    if (isHighlighted && !isSpawning) {
      ctx.strokeStyle = isOnPath ? '#f6e05e' : '#f56565';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }

    // Border for on-chain
    if (node.onChain && !isHighlighted && !isSpawning) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5 / globalScale;
      ctx.stroke();
    }

    // Code indicator for papers with repos
    if (node.githubRepo && !isSpawning) {
      ctx.font = `${Math.max(8 / globalScale, 3)}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText('\u{2022}', node.x + nodeR + 3 / globalScale, node.y - nodeR);
      ctx.font = `bold ${Math.max(7 / globalScale, 2.5)}px monospace`;
      ctx.fillStyle = '#a78bfa';
      ctx.fillText('{ }', node.x + nodeR + 3 / globalScale, node.y - nodeR);
    }

    // Label — always show for spawning nodes, otherwise when zoomed/highlighted
    if (isSpawning || globalScale > 1.5 || isHighlighted) {
      const labelFontSize = isSpawning
        ? Math.max(fontSize * 1.5, 5)
        : isHighlighted ? Math.max(fontSize, 4) : fontSize;
      ctx.font = `${labelFontSize}px Sans-Serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = isSpawning ? 'rgba(34, 211, 238, 1)' : isHighlighted ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.85)';
      ctx.fillText(label, node.x, node.y + nodeR + 2);
    }
  }, [getNodeColor, highlightedIds, pathIds, spawnIds]);

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
    <div ref={outerRef} className="flex flex-col w-full overflow-hidden" style={{ height: 'calc(100vh - 120px)' }}>
      {/* Toolbar — sticky search bar that takes over when sub-nav hides */}
      <div className="sticky top-0 z-[45] flex items-center gap-2 px-4 py-2 border-b border-neutral-200 bg-white flex-shrink-0 overflow-x-auto toolbar-scroll">
        {/* Search */}
        <form className="flex gap-2 flex-1 min-w-0" onSubmit={handleSearch}>
          <div className="relative flex-1 min-w-0">
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search papers..."
              className="flex-1 bg-white border-neutral-200 font-light text-neutral-700 placeholder:text-neutral-400 h-8 text-sm pr-7"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={clearSearch}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Button type="submit" variant="outline" disabled={searching} size="sm" className="border-neutral-300 font-mono text-[10px] uppercase tracking-widest h-8">
            {searching ? '...' : 'Search'}
          </Button>
        </form>

        <Separator orientation="vertical" className="h-6" />

        {/* Core actions */}
        <Button
          variant={showGNNPanel ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowGNNPanel(!showGNNPanel)}
          className="font-mono text-[10px] uppercase tracking-widest h-8 flex-shrink-0"
        >
          <BrainCircuit className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">GNN</span>
        </Button>

        {/* Add Papers — unified dropdown */}
        <Button
          ref={addBtnRef}
          variant={showAddPanel ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowAddPanel(!showAddPanel)}
          className="font-mono text-[10px] uppercase tracking-widest h-8 flex-shrink-0"
        >
          <Plus className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Add</span>
        </Button>
        <AddPapersPanel
          isOpen={showAddPanel}
          onClose={() => setShowAddPanel(false)}
          onAddPaper={handleAddPaper}
          onImportJSON={handleImportPapers}
          onImportBulk={handleImportPapers}
          anchorRef={addBtnRef}
          existingNodeIds={existingNodeIds}
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const exportData = {
              papers: graphData.nodes.map(n => ({
                id: n.id, title: n.title, authors: n.authors, year: n.year,
                citationCount: n.citationCount, fieldsOfStudy: n.fieldsOfStudy,
                abstract: n.abstract, doi: n.doi, arxivId: n.arxivId, source: n.source,
              })),
              citations: graphData.links.map(l => ({
                source: typeof l.source === 'object' ? l.source.id : l.source,
                target: typeof l.target === 'object' ? l.target.id : l.target,
                predicted: l.predicted || false,
              })),
              exportedAt: new Date().toISOString(),
              stats: { papers: graphData.nodes.length, citations: graphData.links.length },
            };
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `republic-knowledge-graph-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="font-mono text-[10px] uppercase tracking-widest h-8 flex-shrink-0"
        >
          <Download className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Export</span>
        </Button>

        {/* View mode toggle */}
        <Button
          variant={viewMode === 'list' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode(v => v === 'graph' ? 'list' : 'graph')}
          className="font-mono text-[10px] uppercase tracking-widest h-8 flex-shrink-0"
          title={viewMode === 'graph' ? 'Switch to List view' : 'Switch to Graph view'}
        >
          {viewMode === 'graph' ? <List className="h-3.5 w-3.5 sm:mr-1" /> : <LayoutGrid className="h-3.5 w-3.5 sm:mr-1" />}
          <span className="hidden sm:inline">{viewMode === 'graph' ? 'List' : 'Graph'}</span>
        </Button>

        <Separator orientation="vertical" className="h-6" />

        <Button
          variant={showControls ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowControls(!showControls)}
          className="font-mono text-[10px] uppercase tracking-widest h-8 flex-shrink-0"
        >
          <SlidersHorizontal className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Filters</span>
          <span className="hidden sm:inline">{showControls ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}</span>
        </Button>
        <Button
          variant={showAgent ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowAgent(!showAgent)}
          className="font-mono text-[10px] uppercase tracking-widest h-8 flex-shrink-0"
        >
          <Compass className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">Navigator</span>
        </Button>
      </div>

      {/* Collapsible controls panel */}
      {showControls && (
        <div className="flex-shrink-0 border-b border-neutral-200 bg-neutral-50 px-4 py-2 space-y-2">
          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showExternal}
                onChange={(e) => setFilters(f => ({ ...f, showExternal: e.target.checked }))}
                className="accent-neutral-700"
              />
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: GRAPH_COLORS.EXTERNAL }}>External</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={filters.showOnChain}
                onChange={(e) => setFilters(f => ({ ...f, showOnChain: e.target.checked }))}
                className="accent-neutral-700"
              />
              <span className="font-mono text-[10px] uppercase tracking-widest" style={{ color: GRAPH_COLORS.ONCHAIN }}>On-Chain</span>
            </label>

            <Separator orientation="vertical" className="h-5" />

            <div className="flex items-center gap-2 min-w-[200px]">
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 whitespace-nowrap">
                Min:
              </span>
              <input
                type="range"
                min="0"
                max={maxCitationInData}
                step="1000"
                value={filters.minCitations}
                onChange={(e) => setFilters(f => ({ ...f, minCitations: Number(e.target.value) }))}
                className="w-20 accent-neutral-500"
              />
              <Input
                type="number"
                min="0"
                max={maxCitationInData}
                value={filters.minCitations}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(Number(e.target.value) || 0, maxCitationInData));
                  setFilters(f => ({ ...f, minCitations: v }));
                }}
                className="w-20 h-6 text-[10px] font-mono px-1.5 border-neutral-200"
              />
            </div>
            <div className="flex items-center gap-2 min-w-[200px]">
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 whitespace-nowrap">
                Max:
              </span>
              <input
                type="range"
                min="0"
                max={maxCitationInData}
                step="1000"
                value={filters.maxCitations}
                onChange={(e) => setFilters(f => ({ ...f, maxCitations: Number(e.target.value) }))}
                className="w-20 accent-neutral-500"
              />
              <Input
                type="number"
                min="0"
                max={maxCitationInData}
                value={filters.maxCitations}
                onChange={(e) => {
                  const v = Math.max(0, Math.min(Number(e.target.value) || 0, maxCitationInData));
                  setFilters(f => ({ ...f, maxCitations: v }));
                }}
                className="w-20 h-6 text-[10px] font-mono px-1.5 border-neutral-200"
              />
            </div>

            <Separator orientation="vertical" className="h-5" />

            <div className="flex items-center gap-2">
              <Switch
                checked={colorByField}
                onCheckedChange={setColorByField}
              />
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Color by field</span>
            </div>
          </div>

          {/* Time slider row */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (playing) {
                  setPlaying(false);
                } else {
                  setFilters(f => ({ ...f, yearRange: [f.yearRange[0], f.yearRange[0]] }));
                  setTimeout(() => setPlaying(true), 50);
                }
              }}
              title={playing ? 'Pause' : 'Play animation'}
              className="h-7 w-7 text-neutral-500 hover:text-neutral-900"
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 whitespace-nowrap">
              {filters.yearRange[0]}<span className="text-neutral-300 mx-1">to</span>{filters.yearRange[1]}
            </span>
            <input
              type="range"
              min={yearBounds.min}
              max={yearBounds.max}
              value={filters.yearRange[0]}
              onChange={(e) => setFilters(f => ({
                ...f,
                yearRange: [Math.min(Number(e.target.value), f.yearRange[1]), f.yearRange[1]],
              }))}
              className="flex-1 accent-neutral-500"
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
              className="flex-1 accent-neutral-500"
            />
          </div>

          {/* Field filter checkboxes */}
          {colorByField && (
            <div className="flex flex-wrap items-center gap-3">
              {Object.entries(FIELD_DISPLAY).map(([field, color]) => (
                <label key={field} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.fields.has(field)}
                    onChange={() => toggleField(field)}
                    className="accent-neutral-700"
                  />
                  <span className="font-mono text-[10px] tracking-wide" style={{ color }}>{field}</span>
                </label>
              ))}
            </div>
          )}

          {/* ── Manage Papers ───────────────────────── */}
          <Separator className="my-1" />
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-400">
                Manage — {graphData.nodes.length} papers
              </span>
              <Button
                variant="ghost"
                size="sm"
                className={`h-5 px-2 text-[9px] font-mono uppercase tracking-widest ${
                  confirmRemoveAll ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-neutral-400 hover:text-red-500'
                }`}
                onClick={handleRemoveAll}
              >
                <Trash2 className="h-2.5 w-2.5 mr-1" />
                {confirmRemoveAll ? 'Click again to confirm' : 'Remove All'}
              </Button>
            </div>

            {/* By Field */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-300 mr-1">Field:</span>
              {fieldDistribution.map(([cat, count]) => {
                const selected = fieldsToRemove.has(cat);
                const color = FIELD_DISPLAY[cat] || '#A0AEC0';
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setFieldsToRemove(prev => {
                        const next = new Set(prev);
                        if (next.has(cat)) next.delete(cat); else next.add(cat);
                        return next;
                      });
                      setConfirmRemove(false);
                    }}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono border transition-colors ${
                      selected
                        ? 'border-red-300 bg-red-50 text-red-600 line-through'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    {cat}: {count}
                  </button>
                );
              })}
            </div>

            {/* By Source */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-widest text-neutral-300 mr-1">Source:</span>
              {sourceDistribution.map(([src, count]) => {
                const selected = sourcesToRemove.has(src);
                const label = src === 'semantic_scholar' ? 'S2' : src === 'pdf_upload' ? 'PDF' : src === 'openalex' ? 'OpenAlex' : src === 'crossref' ? 'Crossref' : src === 'worldbank' ? 'World Bank' : src;
                return (
                  <button
                    key={src}
                    onClick={() => {
                      setSourcesToRemove(prev => {
                        const next = new Set(prev);
                        if (next.has(src)) next.delete(src); else next.add(src);
                        return next;
                      });
                      setConfirmRemove(false);
                    }}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono border transition-colors ${
                      selected
                        ? 'border-red-300 bg-red-50 text-red-600 line-through'
                        : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400'
                    }`}
                  >
                    {label}: {count}
                  </button>
                );
              })}
            </div>

            {/* Remove Selected button */}
            {stagedRemovalCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className={`h-6 text-[10px] font-mono uppercase tracking-widest ${
                  confirmRemove
                    ? 'border-red-400 bg-red-50 text-red-600 hover:bg-red-100'
                    : 'border-red-200 text-red-500 hover:bg-red-50'
                }`}
                onClick={handleBulkRemove}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                {confirmRemove ? `Confirm: remove ${stagedRemovalCount} papers` : `Remove ${stagedRemovalCount} papers`}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* GNN Panel */}
      {showGNNPanel && (
        <div className={`flex-shrink-0 overflow-y-auto ${showControls ? 'max-h-[20vh]' : 'max-h-[30vh]'}`}>
          <GNNPredictor
            graphData={graphData}
            onPredictionsReady={handlePredictions}
          />
        </div>
      )}

      {/* Graph / List — fills all remaining space */}
      <div className="graph-canvas-container relative flex-1 min-h-[200px]" ref={containerRef}>
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24">
            <div className="flex flex-col items-center gap-3">
              <Skeleton className="h-4 w-48 bg-neutral-700/30" />
              <Skeleton className="h-3 w-32 bg-neutral-700/20" />
              <Skeleton className="h-3 w-40 bg-neutral-700/20" />
            </div>
            <p className="font-mono text-xs uppercase tracking-widest text-neutral-500">Loading knowledge graph...</p>
          </div>
        ) : viewMode === 'list' ? (
          <PaperListView
            nodes={filteredData.nodes}
            onSelectPaper={handleNodeClick}
            onRemovePaper={handleRemovePaper}
          />
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

        {/* Legend — only in graph view */}
        {viewMode === 'graph' && (
        <div className="absolute bottom-3 left-3 max-w-[calc(100%-1.5rem)] sm:max-w-[480px] flex flex-wrap items-center gap-x-3 gap-y-1 bg-neutral-900/80 backdrop-blur-sm border border-neutral-700/50 px-3 py-2">
          {colorByField ? (
            <>
              {Object.entries(FIELD_DISPLAY).map(([field, color]) => (
                <div key={field} className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2" style={{ background: color }} />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-300">{field}</span>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2" style={{ background: GRAPH_COLORS.EXTERNAL }} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-300">External ({stats.external})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2" style={{ background: GRAPH_COLORS.ONCHAIN }} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-300">On-Chain ({stats.onChain})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2" style={{ background: GRAPH_COLORS.USER }} />
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-300">Your Papers</span>
              </div>
            </>
          )}
          {showPredictedLinks && predictedLinks && (
            <>
              <Separator orientation="vertical" className="h-3 bg-neutral-600" />
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-[2px] w-4 border-t border-dashed border-purple-400" />
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-300">Predicted ({predictedLinks.length})</span>
              </div>
            </>
          )}
          <Separator orientation="vertical" className="h-3 bg-neutral-600" />
          <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-400">
            {stats.total} papers &middot; {filteredData.links.filter(l => !l.predicted).length} citations
          </span>
        </div>
        )}
      </div>

      {/* Research Agent Sidebar */}
      {showAgent && (
        <div className="fixed inset-0 z-[999] bg-black/20" onClick={() => setShowAgent(false)}>
          <div
            className="absolute right-0 top-0 h-full w-full sm:w-[400px] sm:max-w-[90vw] bg-white border-l border-neutral-200 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <ResearchAgent
              graphData={graphData}
              onGraphAction={handleGraphAction}
              onAddPapers={(papers) => setGraphData(prev => buildGraphFromPapers(papers, prev))}
              onClose={() => setShowAgent(false)}
            />
          </div>
        </div>
      )}

      {/* Paper Detail Sidebar */}
      <PaperDetail
        paper={selectedPaper}
        onClose={() => setSelectedPaper(null)}
        onImport={handleImport}
        onRemove={(paper) => {
          handleRemovePaper(paper.id);
        }}
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
