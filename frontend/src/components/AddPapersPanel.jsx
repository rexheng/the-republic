import React, { useState, useCallback, useRef, useEffect } from 'react';
import { FileUp, FileJson, Library, X, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { parsePdfFile } from '../utils/pdfParser';
import { SAMPLE_COLLECTIONS } from '../utils/sampleCollections';
import { bulkFetchPapers } from '../utils/bulkImport';
import { getSeedGraphData } from '../utils/seedData';

const TABS = [
  { id: 'pdf', label: 'Upload PDF', icon: FileUp },
  { id: 'json', label: 'Import JSON', icon: FileJson },
  { id: 'samples', label: 'Sample Sources', icon: Library },
];

function AddPapersPanel({ isOpen, onClose, onAddPaper, onImportJSON, onImportBulk, anchorRef }) {
  const [activeTab, setActiveTab] = useState('pdf');
  const panelRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  // Position the panel below the anchor button
  useEffect(() => {
    if (!isOpen || !anchorRef?.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPos({
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 432),
    });
  }, [isOpen, anchorRef]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target) &&
          anchorRef?.current && !anchorRef.current.contains(e.target)) {
        onClose();
      }
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="fixed w-[420px] max-w-[calc(100vw-2rem)] z-[900] bg-white border border-neutral-200 shadow-xl"
      style={{ top: pos.top, left: pos.left }}
    >
      {/* Tab bar */}
      <div className="flex border-b border-neutral-200">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-mono uppercase tracking-widest transition-colors ${
              activeTab === tab.id
                ? 'text-neutral-900 border-b-2 border-neutral-900 -mb-px'
                : 'text-neutral-400 hover:text-neutral-600'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {activeTab === 'pdf' && <PdfTab onAddPaper={onAddPaper} onClose={onClose} />}
        {activeTab === 'json' && <JsonTab onImportJSON={onImportJSON} onClose={onClose} />}
        {activeTab === 'samples' && <SamplesTab onImportBulk={onImportBulk} onClose={onClose} />}
      </div>
    </div>
  );
}

// ============================================================
// Upload PDF Tab
// ============================================================

function PdfTab({ onAddPaper, onClose }) {
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [abstract, setAbstract] = useState('');
  const [doi, setDoi] = useState('');
  const fileRef = useRef(null);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    setError(null);
    setParsed(null);

    try {
      const result = await parsePdfFile(file);
      setParsed(result);
      setTitle(result.title || '');
      setAuthors((result.authors || []).join(', '));
      setYear(result.year ? String(result.year) : '');
      setAbstract(result.abstract || '');
      setDoi(result.doi || '');
    } catch (err) {
      setError(err.message);
    }

    setParsing(false);
    if (fileRef.current) fileRef.current.value = '';
  }, []);

  const handleAdd = useCallback(() => {
    const paper = {
      id: `pdf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      paperId: `pdf_${Date.now()}`,
      title: title.trim() || 'Untitled',
      authors: authors.split(',').map(a => a.trim()).filter(Boolean),
      year: year ? parseInt(year) : null,
      citationCount: 0,
      abstract: abstract.trim(),
      fieldsOfStudy: [],
      doi: doi.trim() || null,
      source: 'pdf_upload',
      val: 3,
    };
    onAddPaper(paper);
    onClose();
  }, [title, authors, year, abstract, doi, onAddPaper, onClose]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Upload an academic PDF. Metadata is extracted using Grobid (S2ORC pipeline) with client-side fallback.
      </p>

      {/* File input */}
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf"
          onChange={handleFile}
          className="hidden"
          id="pdf-upload"
        />
        <label
          htmlFor="pdf-upload"
          className="flex items-center justify-center gap-2 border-2 border-dashed border-neutral-300 hover:border-neutral-400 py-4 px-4 cursor-pointer transition-colors text-sm text-neutral-500 hover:text-neutral-700"
        >
          {parsing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Extracting metadata...
            </>
          ) : (
            <>
              <FileUp className="h-4 w-4" />
              Choose PDF file
            </>
          )}
        </label>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-red-600">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}

      {/* Editable fields after parsing */}
      {parsed && (
        <>
          {parsed._method && (
            <div className="text-[10px] font-mono text-neutral-400">
              Extracted via {parsed._method === 'grobid' ? 'Grobid (S2ORC)' : parsed._method === 'pdfjs' ? 'PDF.js (client-side)' : 'filename'}
            </div>
          )}

          <div className="space-y-2">
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Title</label>
              <Input value={title} onChange={e => setTitle(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Authors (comma-separated)</label>
              <Input value={authors} onChange={e => setAuthors(e.target.value)} className="h-8 text-sm" />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Year</label>
                <Input value={year} onChange={e => setYear(e.target.value)} className="h-8 text-sm" type="number" />
              </div>
              <div className="flex-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">DOI</label>
                <Input value={doi} onChange={e => setDoi(e.target.value)} className="h-8 text-sm" />
              </div>
            </div>
            <div>
              <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Abstract</label>
              <Textarea value={abstract} onChange={e => setAbstract(e.target.value)} className="text-xs h-24 resize-none" />
            </div>
          </div>

          <Button
            onClick={handleAdd}
            className="w-full bg-neutral-900 text-white hover:bg-neutral-800 font-mono text-[10px] uppercase tracking-widest"
            disabled={!title.trim()}
          >
            <Check className="mr-1.5 h-3.5 w-3.5" />
            Add to Graph
          </Button>
        </>
      )}
    </div>
  );
}

// ============================================================
// Import JSON Tab
// ============================================================

function JsonTab({ onImportJSON, onClose }) {
  const [count, setCount] = useState(null);
  const fileRef = useRef(null);

  const handleFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const papers = data.papers || data.nodes || [];
        const citations = data.citations || data.links || [];
        if (papers.length === 0) {
          setCount(-1);
          return;
        }
        setCount(papers.length);
        onImportJSON(papers, citations);
        setTimeout(onClose, 800);
      } catch (err) {
        console.error('JSON import failed:', err);
        setCount(-1);
      }
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  }, [onImportJSON, onClose]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500">
        Import a JSON file with papers and citations. Accepts exports from The Republic or custom collections.
      </p>

      <div className="text-[10px] font-mono text-neutral-400 bg-neutral-50 p-2 border border-neutral-100">
        {'{ "papers": [{ id, title, authors, year, ... }], "citations": [{ source, target }] }'}
      </div>

      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={handleFile}
          className="hidden"
          id="json-upload"
        />
        <label
          htmlFor="json-upload"
          className="flex items-center justify-center gap-2 border-2 border-dashed border-neutral-300 hover:border-neutral-400 py-4 px-4 cursor-pointer transition-colors text-sm text-neutral-500 hover:text-neutral-700"
        >
          <FileJson className="h-4 w-4" />
          Choose JSON file
        </label>
      </div>

      {count !== null && (
        <div className={`flex items-center gap-2 text-xs ${count > 0 ? 'text-green-600' : 'text-red-600'}`}>
          {count > 0 ? (
            <><Check className="h-3.5 w-3.5" /> Imported {count} papers</>
          ) : (
            <><AlertCircle className="h-3.5 w-3.5" /> No valid papers found in file</>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sample Sources Tab
// ============================================================

function SamplesTab({ onImportBulk, onClose }) {
  const [loading, setLoading] = useState(null); // collection id
  const [progress, setProgress] = useState(null);
  const [done, setDone] = useState(null);

  const handleLoad = useCallback(async (collection) => {
    setLoading(collection.id);
    setProgress(null);
    setDone(null);

    try {
      if (collection.type === 'seed') {
        // Load bundled seed data
        const data = getSeedGraphData();
        onImportBulk(data.nodes, data.links);
        setDone({ id: collection.id, count: data.nodes.length });
      } else if (collection.type === 'openalex' || collection.type === 'openalex-full') {
        // Pass queries directly — openalex-full uses default, others use collection queries
        const queries = collection.type === 'openalex-full'
          ? undefined
          : collection.queries;

        const { papers, citations } = await bulkFetchPapers(queries, (p) => {
          setProgress(p);
        });

        onImportBulk(papers, citations);
        setDone({ id: collection.id, count: papers.length });
      }
    } catch (err) {
      console.error('Collection load failed:', err);
    }

    setLoading(null);
  }, [onImportBulk]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-500 mb-3">
        Quick-load curated paper collections from OpenAlex or bundled seed data.
      </p>

      {SAMPLE_COLLECTIONS.map(col => {
        const isLoading = loading === col.id;
        const isDone = done?.id === col.id;

        return (
          <div
            key={col.id}
            className="flex items-center justify-between gap-3 border border-neutral-200 hover:border-neutral-300 p-3 transition-colors"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium text-neutral-900 truncate">{col.label}</div>
              <div className="text-[10px] text-neutral-500 truncate">{col.description}</div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLoad(col)}
              disabled={!!loading}
              className="font-mono text-[10px] uppercase tracking-widest h-7 px-3 flex-shrink-0"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  {progress?.phase === 'fetching' ? `${progress.field}...` : 'Loading...'}
                </>
              ) : isDone ? (
                <>
                  <Check className="mr-1 h-3 w-3" />
                  {done.count}
                </>
              ) : (
                'Load'
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

export default AddPapersPanel;
