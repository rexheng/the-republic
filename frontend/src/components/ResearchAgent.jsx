import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, X, Send, ArrowUp, Search, Download, ExternalLink, Eye, BookOpen } from 'lucide-react';
import { buildSystemPrompt, assembleContext, findCitationPath } from '../utils/ragRetrieval';
import { PROVIDERS, detectProvider, callClaude, callOpenAI } from '../utils/llm';
import { searchPapers, buildGraphFromPapers } from '../utils/semanticScholar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const API_KEY_STORAGE = 'rg_llm_api_key';
const API_URL_STORAGE = 'rg_llm_api_url';
const PROVIDER_STORAGE = 'rg_llm_provider';
const MODEL_STORAGE = 'rg_llm_model';

function parseActions(text) {
  const actions = [];
  let cleaned = text.replace(/\[HIGHLIGHT:([\w,]+)\]/g, (_, ids) => {
    actions.push({ type: 'highlight', ids: ids.split(',').map(s => s.trim()) });
    return '';
  }).replace(/\[ZOOM:([\w]+)\]/g, (_, id) => {
    actions.push({ type: 'zoom', id: id.trim() });
    return '';
  }).replace(/\[PATH:([\w]+),([\w]+)\]/g, (_, id1, id2) => {
    actions.push({ type: 'path', from: id1.trim(), to: id2.trim() });
    return '';
  }).replace(/\[SEARCH:([^\]]+)\]/g, (_, query) => {
    actions.push({ type: 'search', query: query.trim() });
    return '';
  });

  // Strip stray paper IDs like /W3099252273 or W3099252273
  cleaned = cleaned.replace(/\/?W\d{5,}/g, '');

  // Convert basic markdown to clean text
  // Remove ## headers — keep the text
  cleaned = cleaned.replace(/^#{1,4}\s+/gm, '');
  // Convert **bold** to just the text (we'll render clean prose)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  // Convert *italic*
  cleaned = cleaned.replace(/\*([^*]+)\*/g, '$1');
  // Clean up multiple blank lines
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  // Clean up leading/trailing whitespace on lines
  cleaned = cleaned.split('\n').map(l => l.trim()).join('\n');

  return { text: cleaned.trim(), actions };
}

const STARTERS = [
  'What are the most influential papers in this graph?',
  'Search for papers on quantum machine learning and add them to the graph',
  'Trace the path from LSTMs to GPT-4',
  'Find connections between biology and machine learning',
  'Search for recent papers on protein folding with AlphaFold',
];

// Paper card component — Consensus AI inspired
function PaperCard({ paper, onViewInGraph, rank }) {
  const year = paper.year || '?';
  const citations = paper.citationCount || 0;
  const authors = (paper.authors || []).slice(0, 3).join(', ');
  const moreAuthors = (paper.authors || []).length > 3 ? ` et al.` : '';
  const fields = (paper.fieldsOfStudy || []).slice(0, 2);
  const relevance = Math.round((paper.relevanceScore || 0) * 100);
  const doi = paper.doi;
  const s2Id = paper.paperId || paper.id;

  // S2 link: prefer DOI, fallback to S2 paper ID
  const s2Url = doi
    ? `https://doi.org/${doi}`
    : s2Id && !String(s2Id).startsWith('W')
      ? `https://www.semanticscholar.org/paper/${s2Id}`
      : null;

  return (
    <div className="group border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm transition-all duration-150 mb-2">
      <div className="flex items-start gap-3 p-3">
        {/* Left accent bar */}
        <div className="w-1 self-stretch bg-neutral-900 rounded-full flex-shrink-0" />

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-medium text-neutral-900 leading-snug line-clamp-2">
              {paper.title}
            </h4>
            <div className="flex items-center gap-2 flex-shrink-0 text-xs text-neutral-500">
              <span>{year}</span>
              <span className="flex items-center gap-0.5">
                {citations.toLocaleString()}
                <BookOpen className="h-3 w-3" />
              </span>
            </div>
          </div>

          {/* Authors */}
          {authors && (
            <p className="text-xs text-neutral-500 mt-0.5 truncate">
              {authors}{moreAuthors}
            </p>
          )}

          {/* Relevance bar */}
          {relevance > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${relevance}%`,
                    background: relevance > 70
                      ? '#16a34a'
                      : relevance > 40
                        ? '#ca8a04'
                        : '#9ca3af',
                  }}
                />
              </div>
              <span className="text-[10px] font-mono text-neutral-400 w-8 text-right">
                {relevance}%
              </span>
            </div>
          )}

          {/* Fields + actions row */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 flex-wrap">
              {fields.map((f, i) => (
                <span
                  key={i}
                  className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 bg-neutral-100 px-1.5 py-0.5"
                >
                  {f}
                </span>
              ))}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onViewInGraph && (
                <button
                  onClick={() => onViewInGraph(paper)}
                  className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 hover:text-neutral-900 flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-neutral-100 transition-colors"
                >
                  <Eye className="h-3 w-3" />
                  View
                </button>
              )}
              {s2Url && (
                <a
                  href={s2Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 hover:text-neutral-900 flex items-center gap-0.5 px-1.5 py-0.5 hover:bg-neutral-100 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Paper
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResearchAgent({ graphData, onGraphAction, onAddPapers, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchingPapers, setSearchingPapers] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || '');
  const [provider, setProvider] = useState(() => localStorage.getItem(PROVIDER_STORAGE) || 'claude');
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem(API_URL_STORAGE) || '');
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_STORAGE) || '');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (apiKey) inputRef.current?.focus();
  }, [apiKey]);

  const saveApiKey = useCallback((key) => {
    setApiKey(key);
    localStorage.setItem(API_KEY_STORAGE, key);
    const detected = detectProvider(key);
    setProvider(detected);
    localStorage.setItem(PROVIDER_STORAGE, detected);
  }, []);

  const saveProvider = useCallback((p) => {
    setProvider(p);
    localStorage.setItem(PROVIDER_STORAGE, p);
    setApiUrl('');
    setModel('');
    localStorage.removeItem(API_URL_STORAGE);
    localStorage.removeItem(MODEL_STORAGE);
  }, []);

  const saveApiUrl = useCallback((url) => {
    setApiUrl(url);
    if (url) localStorage.setItem(API_URL_STORAGE, url);
    else localStorage.removeItem(API_URL_STORAGE);
  }, []);

  const saveModel = useCallback((m) => {
    setModel(m);
    if (m) localStorage.setItem(MODEL_STORAGE, m);
    else localStorage.removeItem(MODEL_STORAGE);
  }, []);

  const getEffectiveModel = useCallback(() => {
    return model || PROVIDERS[provider]?.defaultModel || 'claude-sonnet-4-5-20250929';
  }, [model, provider]);

  const getEffectiveUrl = useCallback(() => {
    return apiUrl || PROVIDERS[provider]?.url || '';
  }, [apiUrl, provider]);

  const handleViewInGraph = useCallback((paper) => {
    if (onGraphAction) {
      onGraphAction({ type: 'zoom', id: paper.id });
    }
  }, [onGraphAction]);

  const sendMessage = useCallback(async (userMessage) => {
    if (!userMessage.trim() || !apiKey || loading) return;

    const newUserMsg = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setLoading(true);

    try {
      const { paperContext, relevantPaperIds, contextPapers } = assembleContext(userMessage, graphData);
      if (relevantPaperIds.length > 0 && onGraphAction) {
        onGraphAction({ type: 'highlight', ids: relevantPaperIds.slice(0, 10) });
      }

      const systemPrompt = buildSystemPrompt(graphData);
      const contextMsg = paperContext ? `\n\nRELEVANT PAPERS FROM THE GRAPH:\n${paperContext}` : '';
      const chatMessages = [
        ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage + contextMsg },
      ];

      let rawContent;
      const effectiveModel = getEffectiveModel();
      const effectiveUrl = getEffectiveUrl();

      if (provider === 'claude') {
        rawContent = await callClaude(apiKey, effectiveModel, systemPrompt, chatMessages, effectiveUrl);
      } else {
        rawContent = await callOpenAI(apiKey, effectiveModel, systemPrompt, chatMessages, effectiveUrl);
      }

      const { text: cleanContent, actions } = parseActions(rawContent);

      // Handle search actions — fetch from S2 and add to graph
      for (const action of actions) {
        if (action.type === 'search' && onAddPapers) {
          setSearchingPapers(true);
          try {
            const results = await searchPapers(action.query, 10);
            if (results.length > 0) {
              onAddPapers(results);
              // Auto-highlight newly added papers
              const newIds = results.map(r => r.paperId || r.id);
              if (onGraphAction) onGraphAction({ type: 'highlight', ids: newIds });
            }
          } catch (e) {
            console.error('Search action failed:', e);
          }
          setSearchingPapers(false);
        } else if (action.type === 'path') {
          const path = findCitationPath(action.from, action.to, graphData);
          if (path && onGraphAction) onGraphAction({ type: 'path', ids: path });
        } else if (onGraphAction) {
          onGraphAction(action);
        }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: cleanContent,
        actions,
        paperIds: relevantPaperIds.slice(0, 8),
        papers: contextPapers.slice(0, 8),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}\n\nMake sure your API key is valid.`,
        isError: true,
      }]);
    }

    setLoading(false);
  }, [apiKey, provider, graphData, messages, loading, onGraphAction, getEffectiveModel, getEffectiveUrl, onAddPapers]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const renderTextContent = (text) => {
    // Split into paragraphs and render clean prose
    const paragraphs = text.split('\n\n').filter(p => p.trim());

    return paragraphs.map((para, i) => {
      const trimmed = para.trim();

      // Detect bullet lists (lines starting with - )
      const lines = trimmed.split('\n');
      const isList = lines.every(l => l.startsWith('- ') || l.trim() === '');

      if (isList) {
        return (
          <ul key={i} className="list-none space-y-1 my-2">
            {lines.filter(l => l.startsWith('- ')).map((l, j) => (
              <li key={j} className="flex items-start gap-2 text-sm text-neutral-700 leading-relaxed">
                <span className="text-neutral-300 mt-1.5">-</span>
                <span>{l.slice(2)}</span>
              </li>
            ))}
          </ul>
        );
      }

      // Regular paragraph
      return (
        <p key={i} className="text-sm text-neutral-700 leading-relaxed mb-2 last:mb-0">
          {trimmed}
        </p>
      );
    });
  };

  const renderMessage = (msg, idx) => {
    if (msg.role === 'user') {
      return (
        <div key={idx} className="flex justify-end mb-4">
          <div className="bg-neutral-900 text-white text-sm px-4 py-2.5 max-w-[85%] rounded-lg">
            {msg.content}
          </div>
        </div>
      );
    }

    return (
      <div key={idx} className="mb-4">
        {/* Text content */}
        <div className={`px-1 ${msg.isError ? 'text-red-600' : ''}`}>
          {msg.isError ? (
            <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-2.5 rounded-lg">
              {msg.content}
            </div>
          ) : (
            renderTextContent(msg.content)
          )}
        </div>

        {/* Paper cards */}
        {msg.papers && msg.papers.length > 0 && (
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Relevant papers
              </span>
              <span className="text-[10px] text-neutral-300">
                {msg.papers.length} found
              </span>
            </div>
            {msg.papers.map((paper, i) => (
              <PaperCard
                key={paper.id || i}
                paper={paper}
                rank={i + 1}
                onViewInGraph={handleViewInGraph}
              />
            ))}
          </div>
        )}

        {/* Action buttons */}
        {msg.actions && msg.actions.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 px-1">
            {msg.actions.map((action, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="font-mono text-[10px] uppercase tracking-widest h-6 px-2"
                onClick={() => onGraphAction && onGraphAction(action)}
              >
                {action.type === 'highlight' && `Show ${action.ids.length} papers`}
                {action.type === 'zoom' && 'Zoom to paper'}
                {action.type === 'path' && 'Show path'}
                {action.type === 'search' && `Added: "${action.query}"`}
              </Button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // No API key — setup
  if (!apiKey) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="flex items-center justify-between p-4 border-b border-neutral-200">
          <span className="font-mono text-xs font-bold uppercase tracking-widest">Research Navigator</span>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-900 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <h4 className="text-lg mb-2">Connect an LLM</h4>
          <p className="text-sm text-neutral-500 mb-6 max-w-xs">
            Enter an API key to power the Research Navigator. Supports Claude, OpenAI, OpenRouter, and any compatible API.
          </p>
          <div className="w-full max-w-xs space-y-3">
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Provider</label>
              <select
                className="w-full h-9 border border-neutral-200 bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-neutral-400"
                value={provider}
                onChange={(e) => saveProvider(e.target.value)}
              >
                {Object.entries(PROVIDERS).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">API Key</label>
              <Input
                type="password"
                placeholder={PROVIDERS[provider]?.placeholder || 'API key...'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            {provider === 'custom' && (
              <div className="space-y-1">
                <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">Endpoint</label>
                <Input
                  type="text"
                  placeholder="https://api.example.com/v1/chat/completions"
                  value={apiUrl}
                  onChange={(e) => saveApiUrl(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Model <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <Input
                type="text"
                placeholder={PROVIDERS[provider]?.defaultModel || 'model name'}
                value={model}
                onChange={(e) => saveModel(e.target.value)}
              />
            </div>
            <Button
              className="w-full bg-neutral-900 text-white hover:bg-neutral-800 font-mono text-xs uppercase tracking-widest"
              onClick={() => saveApiKey(apiKey)}
              disabled={!apiKey.trim()}
            >
              Connect
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-200">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold uppercase tracking-widest">Navigator</span>
          <Badge variant="outline" className="font-mono text-[10px]">{PROVIDERS[provider]?.label || provider}</Badge>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="text-neutral-400 hover:text-neutral-900 transition-colors p-1"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="h-4 w-4" />
          </button>
          <button className="text-neutral-400 hover:text-neutral-900 transition-colors p-1" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Settings */}
      {showSettings && (
        <div className="p-3 border-b border-neutral-200 bg-neutral-50 space-y-2">
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 w-16">Provider</label>
            <select
              className="flex-1 h-7 border border-neutral-200 bg-white px-2 text-xs focus:outline-none"
              value={provider}
              onChange={(e) => saveProvider(e.target.value)}
            >
              {Object.entries(PROVIDERS).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 w-16">Key</label>
            <Input type="password" value={apiKey} onChange={(e) => saveApiKey(e.target.value)} className="h-7 text-xs" />
          </div>
          {provider === 'custom' && (
            <div className="flex items-center gap-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 w-16">URL</label>
              <Input type="text" value={apiUrl} onChange={(e) => saveApiUrl(e.target.value)} placeholder="https://..." className="h-7 text-xs" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-neutral-400 w-16">Model</label>
            <Input type="text" value={model} onChange={(e) => saveModel(e.target.value)} placeholder={PROVIDERS[provider]?.defaultModel || 'model'} className="h-7 text-xs" />
          </div>
          <div className="text-[10px] text-neutral-400 font-mono">
            {graphData.nodes.length.toLocaleString()} papers, {graphData.links.length.toLocaleString()} citations | {getEffectiveModel()}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-neutral-500 mb-4">
              Ask about the {graphData.nodes.length.toLocaleString()} papers in the knowledge graph.
            </p>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {STARTERS.map((q, i) => (
                <button
                  key={i}
                  className="text-xs text-neutral-500 border border-neutral-200 px-3 py-1.5 hover:border-neutral-400 hover:text-neutral-700 transition-colors rounded-full"
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
          <div className="flex justify-start mb-3">
            <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-400">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-neutral-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              {searchingPapers ? 'Searching Semantic Scholar...' : 'Thinking...'}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className="p-3 border-t border-neutral-200 flex gap-2" onSubmit={handleSubmit}>
        <Input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the research landscape..."
          disabled={loading}
          className="flex-1"
        />
        <Button
          type="submit"
          size="icon"
          className="bg-neutral-900 text-white hover:bg-neutral-800"
          disabled={loading || !input.trim()}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

export default ResearchAgent;
