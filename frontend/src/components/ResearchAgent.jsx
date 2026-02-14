import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, X, ArrowUp, ExternalLink, Eye, BookOpen } from 'lucide-react';
import { buildSystemPrompt, assembleContext, findCitationPath } from '../utils/ragRetrieval';
import { PROVIDERS, callLLM, hasStoredApiKey, openApiSettings } from '../utils/llm';
import { searchPapers, buildGraphFromPapers } from '../utils/semanticScholar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const PROVIDER_STORAGE = 'rg_llm_provider';
const MODEL_STORAGE = 'rg_llm_model';
const HISTORY_STORAGE = 'rg_navigator_history';

// ============================================================
// Parse LLM output: extract [SEARCH:...] actions, strip IDs/markdown
// ============================================================

function parseResponse(text) {
  const actions = [];
  let cleaned = text.replace(/\[HIGHLIGHT:([\w,]+)\]/g, () => '')
    .replace(/\[ZOOM:([\w]+)\]/g, () => '')
    .replace(/\[PATH:([\w]+),([\w]+)\]/g, () => '')
    .replace(/\[SEARCH:([^\]]+)\]/g, (_, query) => {
      actions.push({ type: 'search', query: query.trim() });
      return '';
    });

  // Strip stray IDs, markdown
  cleaned = cleaned.replace(/\/?W\d{5,}/g, '');
  cleaned = cleaned.replace(/^#{1,4}\s+/gm, '');
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.split('\n').map(l => l.trim()).join('\n').trim();

  // Extract cited paper numbers [1], [2], [1,3], etc.
  const citedSet = new Set();
  const citationRegex = /\[(\d+(?:,\s*\d+)*)\]/g;
  let match;
  while ((match = citationRegex.exec(cleaned)) !== null) {
    match[1].split(',').forEach(n => {
      const num = parseInt(n.trim());
      if (num > 0 && num <= 25) citedSet.add(num);
    });
  }

  return { text: cleaned, actions, citedNumbers: Array.from(citedSet).sort((a, b) => a - b) };
}

// ============================================================
// Render text with clickable citation superscripts
// ============================================================

function CitedText({ text, onCitationClick }) {
  // Split text into segments: regular text and [n] citations
  const parts = [];
  let lastIdx = 0;
  const regex = /\[(\d+(?:,\s*\d+)*)\]/g;
  let m;

  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIdx) {
      parts.push({ type: 'text', content: text.slice(lastIdx, m.index) });
    }
    parts.push({ type: 'cite', numbers: m[1].split(',').map(n => parseInt(n.trim())) });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) {
    parts.push({ type: 'text', content: text.slice(lastIdx) });
  }

  return (
    <span>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return <span key={i}>{part.content}</span>;
        }
        return (
          <span key={i}>
            {part.numbers.map((n, j) => (
              <button
                key={j}
                onClick={() => onCitationClick(n)}
                className="inline-flex items-center justify-center text-[10px] font-mono font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-full w-4 h-4 mx-0.5 align-super transition-colors cursor-pointer"
                title={`Paper [${n}]`}
              >
                {n}
              </button>
            ))}
          </span>
        );
      })}
    </span>
  );
}

// ============================================================
// Compact paper citation card
// ============================================================

function CitationCard({ paper, number, onViewInGraph }) {
  const year = paper.year || '?';
  const citations = paper.citationCount || 0;
  const authors = (paper.authors || []).slice(0, 3).join(', ');
  const moreAuthors = (paper.authors || []).length > 3 ? ' et al.' : '';
  const doi = paper.doi;
  const s2Id = paper.paperId || paper.id;
  const s2Url = doi
    ? `https://doi.org/${doi}`
    : s2Id && !String(s2Id).startsWith('W')
      ? `https://www.semanticscholar.org/paper/${s2Id}`
      : null;

  return (
    <div className="flex items-start gap-2 py-1.5 group">
      <span className="flex-shrink-0 inline-flex items-center justify-center text-[10px] font-mono font-bold text-blue-600 bg-blue-50 rounded-full w-4 h-4 mt-0.5">
        {number}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          <span className="text-xs font-medium text-neutral-800 leading-snug line-clamp-1 flex-1">
            {paper.title}
          </span>
          <span className="text-[10px] text-neutral-400 flex-shrink-0 whitespace-nowrap">
            {year} &middot; {citations.toLocaleString()} cit.
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-neutral-400 truncate flex-1">
            {authors}{moreAuthors}
          </span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {onViewInGraph && (
              <button
                onClick={() => onViewInGraph(paper)}
                className="text-[9px] font-mono text-neutral-400 hover:text-neutral-900 flex items-center gap-0.5"
              >
                <Eye className="h-2.5 w-2.5" />
              </button>
            )}
            {s2Url && (
              <a
                href={s2Url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[9px] font-mono text-neutral-400 hover:text-neutral-900 flex items-center gap-0.5"
              >
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Starter prompts
// ============================================================

const STARTERS = [
  'What are the most influential papers here?',
  'How did transformers change NLP?',
  'Find connections between biology and ML',
  'Search for papers on protein folding',
];

// ============================================================
// Main component
// ============================================================

function ResearchAgent({ graphData, onGraphAction, onAddPapers, onClose }) {
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchingPapers, setSearchingPapers] = useState(false);
  const [provider, setProvider] = useState(() => localStorage.getItem(PROVIDER_STORAGE) || 'claude');
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_STORAGE) || '');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Persist messages so navigator history survives tab close
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE, JSON.stringify(messages));
    } catch (e) {
      // ignore
    }
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const saveProvider = useCallback((p) => {
    setProvider(p);
    localStorage.setItem(PROVIDER_STORAGE, p);
    setModel('');
    localStorage.removeItem(MODEL_STORAGE);
  }, []);

  const saveModel = useCallback((m) => {
    setModel(m);
    if (m) localStorage.setItem(MODEL_STORAGE, m);
    else localStorage.removeItem(MODEL_STORAGE);
  }, []);

  const getEffectiveModel = useCallback(() => {
    return model || PROVIDERS[provider]?.defaultModel || 'claude-sonnet-4-5-20250929';
  }, [model, provider]);

  const handleViewInGraph = useCallback((paper) => {
    if (onGraphAction) onGraphAction({ type: 'zoom', id: paper.id });
  }, [onGraphAction]);

  const handleCitationClick = useCallback((number, papers) => {
    const paper = papers[number - 1];
    if (paper && onGraphAction) {
      onGraphAction({ type: 'zoom', id: paper.id });
    }
  }, [onGraphAction]);

  const sendMessage = useCallback(async (userMessage) => {
    if (!userMessage.trim() || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInput('');
    setLoading(true);

    try {
      const { paperContext, relevantPaperIds, contextPapers } = assembleContext(userMessage, graphData);
      if (relevantPaperIds.length > 0 && onGraphAction) {
        onGraphAction({ type: 'highlight', ids: relevantPaperIds.slice(0, 8) });
      }

      const systemPrompt = buildSystemPrompt(graphData);
      const contextMsg = paperContext ? `\n\nRELEVANT PAPERS:\n${paperContext}` : '';
      const chatMessages = [
        ...messages.slice(-4).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage + contextMsg },
      ];

      const rawContent = await callLLM(systemPrompt, chatMessages);

      const { text: cleanContent, actions, citedNumbers } = parseResponse(rawContent);

      // Fallback: if parsing stripped everything, use raw content
      const finalContent = cleanContent || rawContent.replace(/\[(?:HIGHLIGHT|ZOOM|PATH|SEARCH):[^\]]*\]/g, '').trim() || 'I found relevant papers but could not generate a summary. See the papers below.';

      // Handle search actions
      for (const action of actions) {
        if (action.type === 'search' && onAddPapers) {
          setSearchingPapers(true);
          try {
            const results = await searchPapers(action.query, 10);
            if (results.length > 0) {
              onAddPapers(results);
              const newIds = results.map(r => r.paperId || r.id);
              if (onGraphAction) onGraphAction({ type: 'highlight', ids: newIds });
            }
          } catch (e) {
            console.error('Search action failed:', e);
          }
          setSearchingPapers(false);
        }
      }

      // Papers: show cited ones first, fall back to top context papers
      let citedPapers = citedNumbers.map(n => contextPapers[n - 1]).filter(Boolean);
      let finalCitedNumbers = citedNumbers.filter((n) => contextPapers[n - 1]);

      // If LLM didn't cite any papers, show top 3 context papers as references
      if (citedPapers.length === 0 && contextPapers.length > 0) {
        citedPapers = contextPapers.slice(0, 3);
        finalCitedNumbers = citedPapers.map((_, i) => i + 1);
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: finalContent,
        actions,
        papers: contextPapers.slice(0, 15),
        citedPapers,
        citedNumbers: finalCitedNumbers,
      }]);
    } catch (err) {
      const isAuthError = /api key|unauthorized|401|403/i.test(err.message);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: isAuthError
          ? `Error: ${err.message}. [OPEN_SETTINGS]`
          : `Error: ${err.message}`,
        isError: true,
      }]);
    }

    setLoading(false);
  }, [graphData, messages, loading, onGraphAction, onAddPapers]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  // ============================================================
  // Render messages
  // ============================================================

  const renderMessage = (msg, idx) => {
    if (msg.role === 'user') {
      return (
        <div key={idx} className="flex justify-end mb-3">
          <div className="bg-neutral-900 text-white text-sm px-3.5 py-2 max-w-[85%] rounded-lg">
            {msg.content}
          </div>
        </div>
      );
    }

    if (msg.isError) {
      const hasSettingsLink = msg.content.includes('[OPEN_SETTINGS]');
      const errorText = msg.content.replace(' [OPEN_SETTINGS]', '');
      return (
        <div key={idx} className="mb-3">
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded">
            {errorText}
            {hasSettingsLink && (
              <button
                onClick={openApiSettings}
                className="block mt-1.5 text-[10px] font-mono uppercase tracking-widest text-red-500 hover:text-red-800 underline underline-offset-2"
              >
                Configure API Key
              </button>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={idx} className="mb-4">
        {/* Answer text with inline citations */}
        <div className="text-sm text-neutral-800 leading-relaxed">
          <CitedText
            text={msg.content}
            onCitationClick={(n) => handleCitationClick(n, msg.papers || [])}
          />
        </div>

        {/* Cited papers — only ones actually referenced */}
        {msg.citedPapers && msg.citedPapers.length > 0 && (
          <div className="mt-2 pt-2 border-t border-neutral-100">
            {msg.citedPapers.map((paper, i) => (
              <CitationCard
                key={paper.id || i}
                paper={paper}
                number={msg.citedNumbers[i]}
                onViewInGraph={handleViewInGraph}
              />
            ))}
          </div>
        )}

        {/* Search action badges */}
        {msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {msg.actions.filter(a => a.type === 'search').map((action, i) => (
              <span key={i} className="text-[10px] font-mono text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                + {action.query}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // Main chat UI
  // ============================================================

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-200">
        <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold uppercase tracking-widest">Navigator</span>
            <Badge variant="outline" className="font-mono text-[9px] h-4">{PROVIDERS[provider]?.label || provider}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <button className="text-neutral-400 hover:text-neutral-900 transition-colors p-1" onClick={() => setShowSettings(!showSettings)} aria-label="Settings">
              <Settings className="h-3.5 w-3.5" />
            </button>
            <button
              className="text-neutral-400 hover:text-neutral-900 transition-colors p-1 text-[11px] font-mono"
              onClick={() => {
                if (confirm('Clear navigator history?')) {
                  setMessages([]);
                  try { localStorage.removeItem(HISTORY_STORAGE); } catch {}
                }
              }}
              aria-label="Clear history"
            >
              Clear
            </button>
            <button className="text-neutral-400 hover:text-neutral-900 transition-colors p-1" onClick={onClose} aria-label="Close">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="p-2.5 border-b border-neutral-200 bg-neutral-50 space-y-1.5">
          <div className="flex items-center gap-2">
            <label className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 w-14">Provider</label>
            <select className="flex-1 h-6 border border-neutral-200 bg-white px-2 text-[11px] focus:outline-none" value={provider} onChange={(e) => saveProvider(e.target.value)}>
              {Object.entries(PROVIDERS).map(([key, p]) => (<option key={key} value={key}>{p.label}</option>))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-mono text-[9px] uppercase tracking-widest text-neutral-400 w-14">Model</label>
            <Input type="text" value={model} onChange={(e) => saveModel(e.target.value)} placeholder={PROVIDERS[provider]?.defaultModel || 'model'} className="h-6 text-[11px]" />
          </div>
          <div className="text-[9px] text-neutral-400 font-mono">
            {graphData.nodes.length.toLocaleString()} papers &middot; {getEffectiveModel()}
            {' '}&middot;{' '}
            <span className={hasStoredApiKey() ? 'text-green-600' : 'text-neutral-400'}>
              {hasStoredApiKey() ? 'Key set' : 'Server key'}
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-xs text-neutral-400 mb-3">
              {graphData.nodes.length.toLocaleString()} papers loaded
            </p>
            <div className="flex flex-col gap-1.5 items-center">
              {STARTERS.map((q, i) => (
                <button
                  key={i}
                  className="text-xs text-neutral-500 border border-neutral-200 px-3 py-1 hover:border-neutral-400 hover:text-neutral-700 transition-colors rounded-full"
                  onClick={() => sendMessage(q)}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, idx) => renderMessage(msg, idx))}

        {loading && (
          <div className="flex items-center gap-2 py-2 text-xs text-neutral-400">
            <div className="flex gap-1">
              <span className="w-1 h-1 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            {searchingPapers ? 'Searching...' : 'Thinking...'}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className="px-3 py-2 border-t border-neutral-200 flex gap-2" onSubmit={handleSubmit}>
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the research..."
          disabled={loading}
          className="flex-1 h-8 text-sm"
        />
        <Button
          type="submit"
          size="icon"
          className="bg-neutral-900 text-white hover:bg-neutral-800 h-8 w-8"
          disabled={loading || !input.trim()}
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </Button>
      </form>
    </div>
  );
}

export default ResearchAgent;
