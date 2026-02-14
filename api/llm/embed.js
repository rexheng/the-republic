// Vercel serverless function — Embedding proxy (Gemini / OpenAI)
import { getEmbeddings } from '../_lib/llm.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { texts, userApiKey } = req.body;
    const embeddings = await getEmbeddings({ texts, userApiKey });
    return res.status(200).json({ embeddings });
  } catch (err) {
    console.error('Embedding proxy error:', err.message);
    const status = err.message.includes('not available') ? 500 : 502;
    return res.status(status).json({ error: err.message });
  }
}
