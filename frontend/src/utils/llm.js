// Shared LLM calling utilities — extracted from ResearchAgent.js
// Used by both ResearchAgent (RAG chat) and AI Research Lab (agent pipeline)

const API_KEY_STORAGE = 'rg_llm_api_key';
const API_URL_STORAGE = 'rg_llm_api_url';
const PROVIDER_STORAGE = 'rg_llm_provider';
const MODEL_STORAGE = 'rg_llm_model';

export const PROVIDERS = {
  claude: {
    label: 'Claude (Anthropic)',
    url: 'https://api.anthropic.com/v1/messages',
    defaultModel: 'claude-sonnet-4-5-20250929',
    placeholder: 'sk-ant-...',
  },
  openai: {
    label: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    defaultModel: 'gpt-4o-mini',
    placeholder: 'sk-...',
  },
  openrouter: {
    label: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'anthropic/claude-sonnet-4-5',
    placeholder: 'sk-or-...',
  },
  custom: {
    label: 'Custom (OpenAI-compatible)',
    url: '',
    defaultModel: '',
    placeholder: 'API key...',
  },
};

export function detectProvider(key) {
  if (!key) return 'claude';
  if (key.startsWith('sk-ant-')) return 'claude';
  if (key.startsWith('sk-or-')) return 'openrouter';
  if (key.startsWith('sk-')) return 'openai';
  return 'claude';
}

export function getLLMConfig() {
  const apiKey = localStorage.getItem(API_KEY_STORAGE) || '';
  const provider = localStorage.getItem(PROVIDER_STORAGE) || 'claude';
  const apiUrl = localStorage.getItem(API_URL_STORAGE) || '';
  const model = localStorage.getItem(MODEL_STORAGE) || '';
  return { apiKey, provider, apiUrl, model };
}

export async function callClaude(apiKey, model, systemPrompt, chatMessages, apiUrl, options = {}) {
  const url = apiUrl || PROVIDERS.claude.url;
  const maxTokens = options.maxTokens || 1500;

  const messages = chatMessages
    .filter(m => m.role !== 'system')
    .map(m => ({ role: m.role, content: m.content }));

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || PROVIDERS.claude.defaultModel,
      system: systemPrompt,
      messages,
      max_tokens: maxTokens,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Claude API error ${response.status}: ${errBody.slice(0, 300)}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find(b => b.type === 'text');
  return textBlock?.text || 'No response received.';
}

export async function callOpenAI(apiKey, model, systemPrompt, chatMessages, apiUrl, options = {}) {
  const url = apiUrl || PROVIDERS.openai.url;
  const maxTokens = options.maxTokens || 1500;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatMessages.filter(m => m.role !== 'system'),
  ];

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  if (url.includes('openrouter')) {
    headers['HTTP-Referer'] = window.location.origin;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: model || PROVIDERS.openai.defaultModel,
      messages,
      max_tokens: maxTokens,
      temperature: options.temperature ?? 0.7,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`API error ${response.status}: ${errBody.slice(0, 300)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'No response received.';
}

export async function callLLM(systemPrompt, userMessages, options = {}) {
  const { apiKey, provider, apiUrl, model } = getLLMConfig();
  if (!apiKey) throw new Error('No API key configured. Please set up an LLM provider in the Research Navigator.');

  const effectiveModel = model || PROVIDERS[provider]?.defaultModel || '';
  const effectiveUrl = apiUrl || PROVIDERS[provider]?.url || '';

  if (provider === 'claude') {
    return callClaude(apiKey, effectiveModel, systemPrompt, userMessages, effectiveUrl, options);
  } else {
    return callOpenAI(apiKey, effectiveModel, systemPrompt, userMessages, effectiveUrl, options);
  }
}
