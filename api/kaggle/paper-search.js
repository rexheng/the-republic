// Vercel serverless: AI paper search for Kaggle Lab
// POST { analysis, provider, model, userApiKey } → JSON array of paper suggestions
// Reuses the shared LLM helper from api/_lib/llm.js

import { callLLM, detectProviderFromKey } from '../_lib/llm.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { analysis, provider, model, userApiKey } = req.body || {};
  if (!analysis) return res.status(400).json({ error: 'analysis object is required' });

  // Extract dataset context from the analysis
  const meta = analysis._meta || {};
  const trainFile = meta.train_file;
  const trainInfo = analysis[trainFile] || {};
  const colsInfo = trainInfo.columns_info || {};
  const targetCol = meta.target_column;

  const featureCols = Object.entries(colsInfo).filter(([k]) => k !== targetCol);
  const numericCount = featureCols.filter(([, v]) => ['continuous', 'discrete'].includes(v.feature_type)).length;
  const catCount = featureCols.filter(([, v]) => ['categorical', 'high_cardinality'].includes(v.feature_type)).length;

  // Build top correlations string
  const corr = trainInfo.correlation || {};
  const topCorr = Object.entries(corr)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 5)
    .map(([k, v]) => `${k.replace('_vs_', ' vs ')}: ${v}`)
    .join(', ') || 'N/A';

  const ctx = {
    rows: trainInfo.rows || '?',
    features: featureCols.length,
    numeric: numericCount,
    categorical: catCount,
    problemType: meta.target_column && colsInfo[meta.target_column]
      ? (colsInfo[meta.target_column].unique <= 20 ? 'classification' : 'regression')
      : 'unknown',
    target: targetCol || '?',
    missing: (meta.missing_columns || []).slice(0, 10).join(', ') || 'none',
    classImbalance: meta.class_balance ? (() => {
      const counts = Object.values(meta.class_balance);
      return counts.length >= 2 ? (Math.max(...counts) / Math.max(Math.min(...counts), 1)).toFixed(1) : 'N/A';
    })() : 'N/A',
    correlations: topCorr,
  };

  const systemPrompt = `You are an ML research advisor for Kaggle competitions. Given a dataset analysis, suggest 3-5 relevant academic papers and the sklearn techniques they inspire. Respond with ONLY a valid JSON array, no markdown or explanation.`;

  const userMessage = `Dataset: ${meta.competition || 'unknown'}
- ${ctx.rows} training rows, ${ctx.features} features (${ctx.numeric} numeric, ${ctx.categorical} categorical)
- Problem type: ${ctx.problemType}, Target: ${ctx.target}
- Missing data columns: ${ctx.missing}
- Class imbalance ratio: ${ctx.classImbalance}
- Top correlations: ${ctx.correlations}

Suggest 3-5 ADDITIONAL papers/techniques. For each, provide:
[{
  "paper_id": "author_year",
  "paper_title": "Full title",
  "technique": "Technique name",
  "reason": "Why relevant for this dataset",
  "sklearn_strategy": "gradient_boosting|random_forest|logistic_regression|ensemble|feature_selection|pca|hyperparameter_search"
}]`;

  // Resolve provider
  let effectiveProvider = provider;
  if (userApiKey) {
    effectiveProvider = detectProviderFromKey(userApiKey) || provider;
  } else if (!effectiveProvider || (effectiveProvider === 'claude' && !process.env.ANTHROPIC_API_KEY)) {
    if (process.env.GEMINI_API_KEY) effectiveProvider = 'gemini';
    else if (process.env.ANTHROPIC_API_KEY) effectiveProvider = 'claude';
    else if (process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY) effectiveProvider = 'openai';
  }

  if (!effectiveProvider && !userApiKey) {
    return res.status(200).json({ suggestions: [], skipped: true, reason: 'No LLM provider available' });
  }

  try {
    const content = await callLLM({
      provider: effectiveProvider,
      model: model || undefined,
      systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
      maxTokens: 2000,
      temperature: 0.4,
      userApiKey,
    });

    // Parse JSON from response (may be wrapped in markdown)
    let suggestions;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    suggestions = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content);

    if (!Array.isArray(suggestions)) {
      return res.status(200).json({ suggestions: [], skipped: true, reason: 'AI returned non-array' });
    }

    return res.status(200).json({ suggestions });
  } catch (err) {
    console.error('Paper search error:', err);
    // Don't fail the pipeline — return empty suggestions
    return res.status(200).json({ suggestions: [], skipped: true, reason: err.message?.slice(0, 200) });
  }
}
