// Shared LLM utility for Vercel serverless functions
// Used by /api/llm/chat and /api/agents to call LLM providers

// Auto-detect provider from API key prefix
export function detectProviderFromKey(key) {
  if (!key) return null;
  if (key.startsWith('AIza')) return 'gemini';
  if (key.startsWith('sk-')) return 'openai';
  return 'claude';
}

export async function callLLM({ provider, model, systemPrompt, messages, maxTokens = 1500, temperature = 0.7, userApiKey }) {
  if (!messages || !Array.isArray(messages)) {
    throw new Error('messages array is required');
  }

  // Auto-detect provider from key prefix
  if (userApiKey) {
    const detected = detectProviderFromKey(userApiKey);
    if (detected && detected !== provider) provider = detected;
  }

  if (provider === 'gemini') {
    const apiKey = userApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Gemini API key not available. Add your key in Settings.');

    const geminiModel = model || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

    const contents = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

    // Prepend system instruction as a user message if present
    if (systemPrompt) {
      contents.unshift({ role: 'user', parts: [{ text: `[System Instructions]\n${systemPrompt}` }] });
      // Ensure alternating roles — add a model ack if next message is also user
      if (contents.length > 1 && contents[1].role === 'user') {
        contents.splice(1, 0, { role: 'model', parts: [{ text: 'Understood.' }] });
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errBody.slice(0, 300)}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned empty response');
    return text;

  } else if (provider === 'claude') {
    const apiKey = userApiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Anthropic API key not available. Add your key in Settings.');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-sonnet-4-5-20250929',
        system: systemPrompt || '',
        messages: messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content })),
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Claude API error: ${errBody.slice(0, 300)}`);
    }

    const data = await response.json();
    const textBlock = data.content?.find(b => b.type === 'text');
    return textBlock?.text || '';

  } else {
    // OpenAI / OpenRouter
    const apiKey = userApiKey || process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('OpenAI/OpenRouter API key not available. Add your key in Settings.');

    const url = provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt || '' },
          ...messages.filter(m => m.role !== 'system'),
        ],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`API error: ${errBody.slice(0, 300)}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

// ─── Embeddings ─────────────────────────────────────────────────────────────

export async function getEmbeddings({ texts, userApiKey }) {
  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    throw new Error('texts array is required');
  }

  // Determine which embedding provider to use based on available keys
  const geminiKey = userApiKey?.startsWith('AIza') ? userApiKey : process.env.GEMINI_API_KEY;
  const openaiKey = userApiKey?.startsWith('sk-') ? userApiKey : process.env.OPENAI_API_KEY;

  if (geminiKey) {
    return getGeminiEmbeddings(texts, geminiKey);
  } else if (openaiKey) {
    return getOpenAIEmbeddings(texts, openaiKey);
  }

  throw new Error('No embedding API key available. Set GEMINI_API_KEY or OPENAI_API_KEY.');
}

async function getGeminiEmbeddings(texts, apiKey) {
  const model = 'text-embedding-004';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:batchEmbedContents?key=${apiKey}`;

  // Gemini batch embed: up to 100 texts per request
  const allEmbeddings = [];
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: batch.map(text => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          taskType: 'RETRIEVAL_DOCUMENT',
        })),
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Gemini embedding error (${response.status}): ${errBody.slice(0, 300)}`);
    }

    const data = await response.json();
    const vectors = (data.embeddings || []).map(e => e.values);
    allEmbeddings.push(...vectors);
  }

  return allEmbeddings;
}

async function getOpenAIEmbeddings(texts, apiKey) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: texts,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenAI embedding error (${response.status}): ${errBody.slice(0, 300)}`);
  }

  const data = await response.json();
  return (data.data || [])
    .sort((a, b) => a.index - b.index)
    .map(d => d.embedding);
}
