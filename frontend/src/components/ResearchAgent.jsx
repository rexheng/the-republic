import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Settings, X, Send, ArrowUp, Search, Download } from 'lucide-react';
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
  const cleaned = text.replace(/\[HIGHLIGHT:([\w,]+)\]/g, (_, ids) => {
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
  return { text: cleaned.trim(), actions };
}

const STARTERS = [
  'What are the most influential papers in this graph?',
  'Search for papers on quantum machine learning and add them to the graph',
  'Trace the path from LSTMs to GPT-4',
  'Find connections between biology and machine learning',
  'Search for recent papers on protein folding with AlphaFold',
];

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

  const sendMessage = useCallback(async (userMessage) => {
    if (!userMessage.trim() || !apiKey || loading) return;

    const newUserMsg = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMsg]);
    setInput('');
    setLoading(true);

    try {
      const { paperContext, relevantPaperIds } = assembleContext(userMessage, graphData);
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

      setMessages(prev => [...prev, { role: 'assistant', content: cleanContent, actions, paperIds: relevantPaperIds.slice(0, 5) }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}\n\nMake sure your API key is valid.`,
        isError: true,
      }]);
    }

    setLoading(false);
  }, [apiKey, provider, graphData, messages, loading, onGraphAction, getEffectiveModel, getEffectiveUrl]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const renderMessage = (msg, idx) => {
    if (msg.role === 'user') {
      return (
        <div key={idx} className="flex justify-end mb-3">
          <div className="bg-neutral-900 text-white text-sm px-4 py-2 max-w-[80%]">
            {msg.content}
          </div>
        </div>
      );
    }

    return (
      <div key={idx} className={`flex justify-start mb-3`}>
        <div className={`text-sm px-4 py-2 max-w-[80%] ${msg.isError ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-neutral-50 border border-neutral-200 text-neutral-700'}`}>
          {msg.content.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < msg.content.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
          {msg.actions && msg.actions.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-neutral-200">
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
      </div>
    );
  };

  // No API key — setup
  if (!apiKey) {
    return (
      <div className="flex flex-col h-full bg-white border-l border-neutral-200">
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
    <div className="flex flex-col h-full bg-white border-l border-neutral-200">
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
      <div className="flex-1 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-neutral-500 mb-4">
              Ask about the {graphData.nodes.length.toLocaleString()} papers in the knowledge graph.
            </p>
            <div className="flex flex-wrap gap-1 justify-center">
              {STARTERS.map((q, i) => (
                <button
                  key={i}
                  className="text-xs text-neutral-500 border border-neutral-200 px-2 py-1 hover:border-neutral-400 hover:text-neutral-700 transition-colors"
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
            <div className="bg-neutral-50 border border-neutral-200 px-4 py-2 text-sm text-neutral-400">
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
