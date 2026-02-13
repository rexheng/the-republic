// Vercel serverless function — LLM proxy (Anthropic / Gemini / OpenAI)
import { callLLM } from '../_lib/llm.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { provider, model, systemPrompt, messages, maxTokens, temperature, userApiKey } = req.body;
    const content = await callLLM({ provider, model, systemPrompt, messages, maxTokens, temperature, userApiKey });
    return res.status(200).json({ content });
  } catch (err) {
    console.error('LLM proxy error:', err.message);
    const status = err.message.includes('not available') ? 500 : err.message.includes('API error') ? 502 : 500;
    return res.status(status).json({ error: err.message });
  }
}
