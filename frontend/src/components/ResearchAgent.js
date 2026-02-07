import React, { useState, useRef, useEffect, useCallback } from 'react';
import { buildSystemPrompt, assembleContext, findCitationPath } from '../utils/ragRetrieval';
import { PROVIDERS, detectProvider, callClaude, callOpenAI } from '../utils/llm';

const API_KEY_STORAGE = 'rg_llm_api_key';
const API_URL_STORAGE = 'rg_llm_api_url';
const PROVIDER_STORAGE = 'rg_llm_provider';
const MODEL_STORAGE = 'rg_llm_model';

// Parse graph actions from LLM response: [HIGHLIGHT:id1,id2], [ZOOM:id], [PATH:id1,id2]
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
  });
  return { text: cleaned.trim(), actions };
}

// Suggested starter questions
const STARTERS = [
  'What are the most influential papers in this graph?',
  'Trace the path from LSTMs to GPT-4',
  'Find connections between biology and machine learning',
  'What are the hottest research areas in the last 3 years?',
  'Recommend papers on diffusion models',
];

function ResearchAgent({ graphData, onGraphAction, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || '');
  const [provider, setProvider] = useState(() => localStorage.getItem(PROVIDER_STORAGE) || 'claude');
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem(API_URL_STORAGE) || '');
  const [model, setModel] = useState(() => localStorage.getItem(MODEL_STORAGE) || '');
  const [showSettings, setShowSettings] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (apiKey) inputRef.current?.focus();
  }, [apiKey]);

  const saveApiKey = useCallback((key) => {
    setApiKey(key);
    localStorage.setItem(API_KEY_STORAGE, key);
    // Auto-detect provider
    const detected = detectProvider(key);
    setProvider(detected);
    localStorage.setItem(PROVIDER_STORAGE, detected);
  }, []);

  const saveProvider = useCallback((p) => {
    setProvider(p);
    localStorage.setItem(PROVIDER_STORAGE, p);
    // Reset URL and model to provider defaults
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
      // RAG: retrieve relevant papers
      const { paperContext, relevantPaperIds } = assembleContext(userMessage, graphData);

      // Highlight retrieved papers on graph
      if (relevantPaperIds.length > 0 && onGraphAction) {
        onGraphAction({ type: 'highlight', ids: relevantPaperIds.slice(0, 10) });
      }

      // Build system prompt and messages
      const systemPrompt = buildSystemPrompt(graphData);
      const contextMsg = paperContext
        ? `\n\nRELEVANT PAPERS FROM THE GRAPH:\n${paperContext}`
        : '';

      const chatMessages = [
        ...messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage + contextMsg },
      ];

      // Route to the right API
      let rawContent;
      const effectiveModel = getEffectiveModel();
      const effectiveUrl = getEffectiveUrl();

      if (provider === 'claude') {
        rawContent = await callClaude(apiKey, effectiveModel, systemPrompt, chatMessages, effectiveUrl);
      } else {
        rawContent = await callOpenAI(apiKey, effectiveModel, systemPrompt, chatMessages, effectiveUrl);
      }

      // Parse graph actions from response
      const { text: cleanContent, actions } = parseActions(rawContent);

      // Execute graph actions
      for (const action of actions) {
        if (action.type === 'path') {
          const path = findCitationPath(action.from, action.to, graphData);
          if (path && onGraphAction) {
            onGraphAction({ type: 'path', ids: path });
          }
        } else if (onGraphAction) {
          onGraphAction(action);
        }
      }

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: cleanContent,
        actions,
        paperIds: relevantPaperIds.slice(0, 5),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err.message}\n\nMake sure your API key is valid. ${provider === 'claude' ? 'For Claude, you need an Anthropic API key starting with sk-ant-.' : ''}`,
        isError: true,
      }]);
    }

    setLoading(false);
  }, [apiKey, provider, graphData, messages, loading, onGraphAction, getEffectiveModel, getEffectiveUrl]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Render a single message
  const renderMessage = (msg, idx) => {
    if (msg.role === 'user') {
      return (
        <div key={idx} className="ra-msg ra-msg-user">
          <div className="ra-msg-content">{msg.content}</div>
        </div>
      );
    }

    return (
      <div key={idx} className={`ra-msg ra-msg-assistant ${msg.isError ? 'ra-msg-error' : ''}`}>
        <div className="ra-msg-content">
          {msg.content.split('\n').map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < msg.content.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
        {msg.actions && msg.actions.length > 0 && (
          <div className="ra-msg-actions">
            {msg.actions.map((action, i) => (
              <button
                key={i}
                className="ra-action-btn"
                onClick={() => onGraphAction && onGraphAction(action)}
              >
                {action.type === 'highlight' && `Show ${action.ids.length} papers`}
                {action.type === 'zoom' && 'Zoom to paper'}
                {action.type === 'path' && 'Show path'}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // No API key yet — show setup
  if (!apiKey) {
    return (
      <div className="ra-panel">
        <div className="ra-header">
          <h3>Research Navigator AI</h3>
          <button className="ra-close" onClick={onClose}>&times;</button>
        </div>
        <div className="ra-setup">
          <div className="ra-setup-icon">&#x1F9ED;</div>
          <h4>Connect an LLM</h4>
          <p>Enter an API key to power the Research Navigator. Supports Claude, OpenAI, OpenRouter, and any OpenAI-compatible API.</p>
          <div className="ra-setup-form">
            <label>Provider</label>
            <select
              className="ra-select"
              value={provider}
              onChange={(e) => saveProvider(e.target.value)}
            >
              {Object.entries(PROVIDERS).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
            </select>

            <label>API Key</label>
            <input
              type="password"
              placeholder={PROVIDERS[provider]?.placeholder || 'API key...'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="ra-input"
            />

            {provider === 'custom' && (
              <>
                <label>Endpoint URL</label>
                <input
                  type="text"
                  placeholder="https://api.example.com/v1/chat/completions"
                  value={apiUrl}
                  onChange={(e) => saveApiUrl(e.target.value)}
                  className="ra-input"
                />
              </>
            )}

            <label>Model <span className="ra-optional">(optional — defaults to {PROVIDERS[provider]?.defaultModel || '...'})</span></label>
            <input
              type="text"
              placeholder={PROVIDERS[provider]?.defaultModel || 'model name'}
              value={model}
              onChange={(e) => saveModel(e.target.value)}
              className="ra-input"
            />

            <button
              className="ra-connect-btn"
              onClick={() => saveApiKey(apiKey)}
              disabled={!apiKey.trim()}
            >
              Connect with {PROVIDERS[provider]?.label || 'API'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ra-panel">
      {/* Header */}
      <div className="ra-header">
        <div className="ra-header-left">
          <span className="ra-header-icon">&#x1F9ED;</span>
          <h3>Research Navigator</h3>
          <span className="ra-provider-badge">{PROVIDERS[provider]?.label || provider}</span>
        </div>
        <div className="ra-header-right">
          <button
            className="ra-settings-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            &#x2699;
          </button>
          <button className="ra-close" onClick={onClose}>&times;</button>
        </div>
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div className="ra-settings">
          <div className="ra-settings-row">
            <label>Provider</label>
            <select
              className="ra-select ra-select-sm"
              value={provider}
              onChange={(e) => saveProvider(e.target.value)}
            >
              {Object.entries(PROVIDERS).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="ra-settings-row">
            <label>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => saveApiKey(e.target.value)}
              className="ra-input ra-input-sm"
            />
          </div>
          {provider === 'custom' && (
            <div className="ra-settings-row">
              <label>Endpoint</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => saveApiUrl(e.target.value)}
                className="ra-input ra-input-sm"
                placeholder="https://..."
              />
            </div>
          )}
          <div className="ra-settings-row">
            <label>Model</label>
            <input
              type="text"
              value={model}
              onChange={(e) => saveModel(e.target.value)}
              className="ra-input ra-input-sm"
              placeholder={PROVIDERS[provider]?.defaultModel || 'model'}
            />
          </div>
          <div className="ra-settings-info">
            Graph: {graphData.nodes.length.toLocaleString()} papers, {graphData.links.length.toLocaleString()} citations
            <br />Using: {getEffectiveModel()}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="ra-messages">
        {messages.length === 0 && (
          <div className="ra-welcome">
            <p className="ra-welcome-text">
              Ask me anything about the {graphData.nodes.length.toLocaleString()} papers in the knowledge graph. I can trace citation paths, find cross-field connections, and navigate the graph for you.
            </p>
            <div className="ra-starters">
              {STARTERS.map((q, i) => (
                <button
                  key={i}
                  className="ra-starter"
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
          <div className="ra-msg ra-msg-assistant ra-msg-loading">
            <div className="ra-typing">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form className="ra-input-bar" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about the research landscape..."
          className="ra-chat-input"
          disabled={loading}
        />
        <button
          type="submit"
          className="ra-send-btn"
          disabled={loading || !input.trim()}
        >
          &#x2191;
        </button>
      </form>
    </div>
  );
}

export default ResearchAgent;
