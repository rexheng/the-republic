// Pure JS 2-layer Graph Convolutional Network for link prediction
// No dependencies — just typed array matrix ops. Trivial compute for <500 nodes.

// ============================================================
// Matrix helpers — all operate on {data: Float64Array, rows, cols}
// ============================================================

function createMatrix(rows, cols, fill = 0) {
  return { data: new Float64Array(rows * cols).fill(fill), rows, cols };
}

function matMul(A, B) {
  if (A.cols !== B.rows) throw new Error(`matMul: ${A.cols} !== ${B.rows}`);
  const C = createMatrix(A.rows, B.cols);
  for (let i = 0; i < A.rows; i++) {
    for (let k = 0; k < A.cols; k++) {
      const a = A.data[i * A.cols + k];
      if (a === 0) continue;
      for (let j = 0; j < B.cols; j++) {
        C.data[i * C.cols + j] += a * B.data[k * B.cols + j];
      }
    }
  }
  return C;
}

function relu(M) {
  const out = createMatrix(M.rows, M.cols);
  for (let i = 0; i < M.data.length; i++) {
    out.data[i] = M.data[i] > 0 ? M.data[i] : 0;
  }
  return out;
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
}

function xavierInit(rows, cols) {
  const std = Math.sqrt(2 / (rows + cols));
  const M = createMatrix(rows, cols);
  for (let i = 0; i < M.data.length; i++) {
    // Box-Muller
    const u1 = Math.random() || 1e-10;
    const u2 = Math.random();
    M.data[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * std;
  }
  return M;
}

function transpose(M) {
  const T = createMatrix(M.cols, M.rows);
  for (let i = 0; i < M.rows; i++) {
    for (let j = 0; j < M.cols; j++) {
      T.data[j * T.cols + i] = M.data[i * M.cols + j];
    }
  }
  return T;
}

// Element-wise operations for backprop
function matScale(M, s) {
  const out = createMatrix(M.rows, M.cols);
  for (let i = 0; i < M.data.length; i++) out.data[i] = M.data[i] * s;
  return out;
}

function reluGrad(M) {
  const out = createMatrix(M.rows, M.cols);
  for (let i = 0; i < M.data.length; i++) out.data[i] = M.data[i] > 0 ? 1 : 0;
  return out;
}

function hadamard(A, B) {
  const C = createMatrix(A.rows, A.cols);
  for (let i = 0; i < A.data.length; i++) C.data[i] = A.data[i] * B.data[i];
  return C;
}

// ============================================================
// Graph construction
// ============================================================

export function buildAdjacencyNormalized(nodes, links) {
  const n = nodes.length;
  const idToIdx = new Map();
  nodes.forEach((node, i) => idToIdx.set(node.id, i));

  // A + I (adjacency with self-loops)
  const A = createMatrix(n, n);
  for (let i = 0; i < n; i++) A.data[i * n + i] = 1; // self-loop

  links.forEach(link => {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    if (link.predicted) return; // skip predicted links
    const si = idToIdx.get(src);
    const ti = idToIdx.get(tgt);
    if (si !== undefined && ti !== undefined) {
      A.data[si * n + ti] = 1;
      A.data[ti * n + si] = 1; // symmetric
    }
  });

  // D^(-1/2)
  const dInvSqrt = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let deg = 0;
    for (let j = 0; j < n; j++) deg += A.data[i * n + j];
    dInvSqrt[i] = deg > 0 ? 1 / Math.sqrt(deg) : 0;
  }

  // A_hat = D^(-1/2) * A * D^(-1/2)
  const A_hat = createMatrix(n, n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      A_hat.data[i * n + j] = dInvSqrt[i] * A.data[i * n + j] * dInvSqrt[j];
    }
  }

  return { A_hat, idToIdx };
}

// ============================================================
// Feature matrix: 8 features per node
// ============================================================

export function buildFeatureMatrix(nodes, idToIdx, links) {
  const n = nodes.length;
  const FEAT_DIM = 8;
  const X = createMatrix(n, FEAT_DIM);

  // Compute degree for each node
  const degree = new Float64Array(n);
  links.forEach(link => {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    if (link.predicted) return;
    const si = idToIdx.get(src);
    const ti = idToIdx.get(tgt);
    if (si !== undefined) degree[si]++;
    if (ti !== undefined) degree[ti]++;
  });

  // Normalize year
  const years = nodes.map(n => n.year || 2020);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const yearSpan = maxYear - minYear || 1;

  // Citation tiers
  const citationThresholds = [100, 1000, 10000, 50000];

  nodes.forEach((node, i) => {
    const base = i * FEAT_DIM;
    // Feature 0: log citations (normalized)
    X.data[base + 0] = Math.log10((node.citationCount || 0) + 1) / 6;
    // Feature 1: year normalized [0, 1]
    X.data[base + 1] = ((node.year || 2020) - minYear) / yearSpan;
    // Feature 2: has GitHub repo
    X.data[base + 2] = node.githubRepo ? 1 : 0;
    // Feature 3: degree (normalized)
    X.data[base + 3] = Math.min(degree[i] / 20, 1);
    // Features 4-7: citation tier one-hot
    const cites = node.citationCount || 0;
    let tier = 0;
    for (let t = 0; t < citationThresholds.length; t++) {
      if (cites >= citationThresholds[t]) tier = t + 1;
    }
    if (tier < 4) X.data[base + 4 + tier] = 1;
    else X.data[base + 7] = 1; // top tier
  });

  return { X, FEAT_DIM };
}

// ============================================================
// GCN Forward Pass
// ============================================================

export function gcnForward(A_hat, X, W1, W2) {
  // Z1 = ReLU(A_hat * X * W1)
  const XW1 = matMul(X, W1);
  const AXW1 = matMul(A_hat, XW1);
  const Z1 = relu(AXW1);

  // H2 = A_hat * Z1 * W2
  const Z1W2 = matMul(Z1, W2);
  const H2 = matMul(A_hat, Z1W2);

  return { Z1, AXW1, H2 };
}

// ============================================================
// Training: BCE loss on edges vs. random non-edges
// ============================================================

function sampleNegativeEdges(n, positiveSet, count) {
  const negatives = [];
  let attempts = 0;
  while (negatives.length < count && attempts < count * 10) {
    const i = Math.floor(Math.random() * n);
    const j = Math.floor(Math.random() * n);
    if (i !== j && !positiveSet.has(`${i}-${j}`)) {
      negatives.push([i, j]);
      positiveSet.add(`${i}-${j}`); // prevent duplicates in negatives
    }
    attempts++;
  }
  return negatives;
}

function dotProduct(H, i, j) {
  let sum = 0;
  const cols = H.cols;
  for (let k = 0; k < cols; k++) {
    sum += H.data[i * cols + k] * H.data[j * cols + k];
  }
  return sum;
}

export async function trainGCN(A_hat, X, edges, config = {}) {
  const {
    hiddenDim = 32,
    embedDim = 16,
    epochs = 100,
    lr = 0.01,
    onProgress = null,
  } = config;

  const n = X.rows;
  const featDim = X.cols;

  // Initialize weights
  let W1 = xavierInit(featDim, hiddenDim);
  let W2 = xavierInit(hiddenDim, embedDim);

  // Build positive edge index set
  const posSet = new Set();
  edges.forEach(([i, j]) => posSet.add(`${i}-${j}`));

  // Sample negative edges once
  const negEdges = sampleNegativeEdges(n, new Set(posSet), edges.length);

  let loss = 0;

  for (let epoch = 0; epoch < epochs; epoch++) {
    // Forward pass
    const { Z1, AXW1, H2 } = gcnForward(A_hat, X, W1, W2);

    // Compute BCE loss and gradients
    const lossAcc = { val: 0 };
    const dH2 = createMatrix(n, embedDim);

    // Positive edges
    for (let ei = 0; ei < edges.length; ei++) {
      const [i, j] = edges[ei];
      const score = dotProduct(H2, i, j);
      const pred = sigmoid(score);
      lossAcc.val -= Math.log(pred + 1e-10);
      const grad = pred - 1;
      for (let k = 0; k < embedDim; k++) {
        dH2.data[i * embedDim + k] += grad * H2.data[j * embedDim + k];
        dH2.data[j * embedDim + k] += grad * H2.data[i * embedDim + k];
      }
    }

    // Negative edges
    for (let ei = 0; ei < negEdges.length; ei++) {
      const [i, j] = negEdges[ei];
      const score = dotProduct(H2, i, j);
      const pred = sigmoid(score);
      lossAcc.val -= Math.log(1 - pred + 1e-10);
      const grad = pred;
      for (let k = 0; k < embedDim; k++) {
        dH2.data[i * embedDim + k] += grad * H2.data[j * embedDim + k];
        dH2.data[j * embedDim + k] += grad * H2.data[i * embedDim + k];
      }
    }

    const totalEdges = edges.length + negEdges.length;
    const scaledDH2 = matScale(dH2, 1 / totalEdges);
    loss = lossAcc.val / totalEdges;

    // Backprop through layer 2: H2 = A_hat * Z1 * W2
    // dW2 = Z1^T * A_hat^T * scaledDH2
    const A_hatT = transpose(A_hat);
    const dAZ1W2 = matMul(A_hatT, scaledDH2);
    const Z1T = transpose(Z1);
    const dW2 = matMul(Z1T, dAZ1W2);

    // dZ1 = A_hat^T * scaledDH2 * W2^T, masked by relu grad
    const W2T = transpose(W2);
    const dZ1_pre = matMul(dAZ1W2, W2T);
    const reluMask = reluGrad(AXW1);
    const dZ1 = hadamard(dZ1_pre, reluMask);

    // Backprop through layer 1: Z1 = ReLU(A_hat * X * W1)
    const dAXW1 = matMul(A_hatT, dZ1);
    const XT = transpose(X);
    const dW1 = matMul(XT, dAXW1);

    // Update weights with gradient descent
    for (let i = 0; i < W1.data.length; i++) W1.data[i] -= lr * dW1.data[i];
    for (let i = 0; i < W2.data.length; i++) W2.data[i] -= lr * dW2.data[i];

    // Yield to UI every 10 epochs
    if (onProgress && epoch % 10 === 0) {
      onProgress({ epoch, loss, totalEpochs: epochs });
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // Final forward pass with trained weights
  const { H2: embeddings } = gcnForward(A_hat, X, W1, W2);
  return { embeddings, loss, W1, W2 };
}

// ============================================================
// Link Prediction
// ============================================================

export function predictLinks(H, idToIdx, nodes, existingEdgeSet, topK = 20) {
  const n = H.rows;
  const predictions = [];
  const idxToId = new Map();
  idToIdx.forEach((idx, id) => idxToId.set(idx, id));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const idI = idxToId.get(i);
      const idJ = idxToId.get(j);
      if (existingEdgeSet.has(`${idI}->${idJ}`) || existingEdgeSet.has(`${idJ}->${idI}`)) continue;

      const score = dotProduct(H, i, j);
      const confidence = sigmoid(score);
      if (confidence > 0.5) {
        predictions.push({
          source: idI,
          target: idJ,
          score: confidence,
          sourceName: nodes[i].title,
          targetName: nodes[j].title,
        });
      }
    }
  }

  predictions.sort((a, b) => b.score - a.score);
  return predictions.slice(0, topK);
}

// ============================================================
// Entry point: orchestrates the full pipeline
// ============================================================

export async function runGNNPipeline(graphData, callbacks = {}) {
  const { onPhaseStart, onPhaseComplete, onTrainingProgress } = callbacks;

  const nodes = graphData.nodes;
  const links = graphData.links.filter(l => !l.predicted);

  // Phase 1: Build graph features
  if (onPhaseStart) onPhaseStart(1, 'Building Graph Features');
  await new Promise(r => setTimeout(r, 100));

  const { A_hat, idToIdx } = buildAdjacencyNormalized(nodes, links);
  const { X, FEAT_DIM } = buildFeatureMatrix(nodes, idToIdx, links);

  // Build edge index pairs
  const edgePairs = [];
  links.forEach(link => {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    const si = idToIdx.get(src);
    const ti = idToIdx.get(tgt);
    if (si !== undefined && ti !== undefined) {
      edgePairs.push([si, ti]);
    }
  });

  if (onPhaseComplete) onPhaseComplete(1, { nodeCount: nodes.length, edgeCount: edgePairs.length, featDim: FEAT_DIM });

  // Phase 2: Train GCN
  if (onPhaseStart) onPhaseStart(2, 'Training GCN');
  await new Promise(r => setTimeout(r, 100));

  const { embeddings, loss } = await trainGCN(A_hat, X, edgePairs, {
    hiddenDim: 32,
    embedDim: 16,
    epochs: 100,
    lr: 0.01,
    onProgress: onTrainingProgress,
  });

  if (onPhaseComplete) onPhaseComplete(2, { finalLoss: loss });

  // Phase 3: Predict links
  if (onPhaseStart) onPhaseStart(3, 'Predicting Links');
  await new Promise(r => setTimeout(r, 100));

  // Build existing edge set
  const existingEdgeSet = new Set();
  links.forEach(link => {
    const src = typeof link.source === 'object' ? link.source.id : link.source;
    const tgt = typeof link.target === 'object' ? link.target.id : link.target;
    existingEdgeSet.add(`${src}->${tgt}`);
    existingEdgeSet.add(`${tgt}->${src}`);
  });

  const predictions = predictLinks(embeddings, idToIdx, nodes, existingEdgeSet, 20);

  if (onPhaseComplete) onPhaseComplete(3, { predictions });

  return predictions;
}
