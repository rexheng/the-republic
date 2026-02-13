// Vercel serverless: Kaggle competition data download proxy
// POST { competition, apiToken } → streams zip back to browser

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { competition, apiToken } = req.body || {};
  if (!competition) return res.status(400).json({ error: 'competition slug is required' });
  if (!apiToken) return res.status(400).json({ error: 'Kaggle API token is required' });

  // Parse token — support both "KGAT_..." format and "username:key" format
  let username, key;
  if (apiToken.startsWith('KGAT_')) {
    // New-style token — use as Bearer
    username = null;
    key = apiToken;
  } else if (apiToken.includes(':')) {
    [username, key] = apiToken.split(':', 2);
  } else {
    return res.status(400).json({ error: 'Invalid token format. Use KGAT_... or username:key' });
  }

  const slug = competition.replace(/[^a-zA-Z0-9-]/g, '');
  const url = `https://www.kaggle.com/api/v1/competitions/data/download/${slug}`;

  try {
    const headers = { 'Accept': 'application/octet-stream' };
    if (username) {
      // Basic auth for legacy tokens
      headers['Authorization'] = 'Basic ' + Buffer.from(`${username}:${key}`).toString('base64');
    } else {
      // Bearer auth for KGAT_ tokens
      headers['Authorization'] = `Bearer ${key}`;
    }

    const kaggleRes = await fetch(url, { headers, redirect: 'follow' });

    if (!kaggleRes.ok) {
      const errText = await kaggleRes.text().catch(() => '');
      return res.status(kaggleRes.status).json({
        error: `Kaggle API error (${kaggleRes.status}): ${errText.slice(0, 200)}`,
      });
    }

    // Check content length — warn if huge
    const contentLength = kaggleRes.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 50 * 1024 * 1024) {
      return res.status(413).json({
        error: 'Dataset is too large for browser download (>50MB). Please upload train.csv and test.csv manually.',
        size: parseInt(contentLength),
      });
    }

    // Stream the zip back
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.zip"`);
    if (contentLength) res.setHeader('Content-Length', contentLength);

    // Read entire body and send (Vercel serverless doesn't support true streaming)
    const buffer = Buffer.from(await kaggleRes.arrayBuffer());
    res.status(200).send(buffer);
  } catch (err) {
    console.error('Kaggle download proxy error:', err);
    res.status(500).json({ error: err.message || 'Failed to download from Kaggle' });
  }
}
