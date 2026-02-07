/**
 * Paper Technique Map — Frontend display data for paper registry.
 * No sklearn code — purely for UI rendering (technique names, icons, tags).
 */

const PAPER_TECHNIQUE_MAP = {
  srivastava2014: {
    paperTitle: 'Dropout: A Simple Way to Prevent Neural Networks from Overfitting',
    technique: 'Dropout Regularization',
    icon: '🛡️',
    tag: 'Regularization',
    color: '#6366f1',
    year: 2014,
  },
  ioffe2015: {
    paperTitle: 'Batch Normalization: Accelerating Deep Network Training',
    technique: 'Aggressive Scaling',
    icon: '📊',
    tag: 'Normalization',
    color: '#8b5cf6',
    year: 2015,
  },
  kingma2015: {
    paperTitle: 'Adam: A Method for Stochastic Optimization',
    technique: 'Adaptive LR GBM',
    icon: '⚡',
    tag: 'Optimization',
    color: '#f59e0b',
    year: 2015,
  },
  he2016: {
    paperTitle: 'Deep Residual Learning for Image Recognition',
    technique: 'Residual Features',
    icon: '🔗',
    tag: 'Feature Eng.',
    color: '#10b981',
    year: 2016,
  },
  goodfellow2014: {
    paperTitle: 'Generative Adversarial Networks',
    technique: 'Class Balancing',
    icon: '⚖️',
    tag: 'Augmentation',
    color: '#ef4444',
    year: 2014,
  },
  mikolov2013: {
    paperTitle: 'Efficient Estimation of Word Representations in Vector Space',
    technique: 'Frequency Encoding',
    icon: '📝',
    tag: 'Encoding',
    color: '#06b6d4',
    year: 2013,
  },
  hinton2006: {
    paperTitle: 'Reducing the Dimensionality of Data with Neural Networks',
    technique: 'PCA Reduction',
    icon: '🔬',
    tag: 'Dim. Reduction',
    color: '#84cc16',
    year: 2006,
  },
  vaswani2017: {
    paperTitle: 'Attention Is All You Need',
    technique: 'Feature Selection',
    icon: '🎯',
    tag: 'Selection',
    color: '#f43f5e',
    year: 2017,
  },
  kipf2017: {
    paperTitle: 'Semi-Supervised Classification with Graph Convolutional Networks',
    technique: 'Pseudo-Labeling',
    icon: '🕸️',
    tag: 'Semi-supervised',
    color: '#a855f7',
    year: 2017,
  },
  zoph2017: {
    paperTitle: 'Neural Architecture Search with Reinforcement Learning',
    technique: 'Hyperparameter Search',
    icon: '🔍',
    tag: 'AutoML',
    color: '#3b82f6',
    year: 2017,
  },
  loshchilov2019: {
    paperTitle: 'Decoupled Weight Decay Regularization (AdamW)',
    technique: 'Weight Decay + L1 Selection',
    icon: '🏋️',
    tag: 'Regularization',
    color: '#6366f1',
    year: 2019,
  },
  bahdanau2015: {
    paperTitle: 'Neural Machine Translation by Jointly Learning to Align and Translate',
    technique: 'Tree-based Selection',
    icon: '🌲',
    tag: 'Selection',
    color: '#22c55e',
    year: 2015,
  },
  kaplan2020: {
    paperTitle: 'Scaling Laws for Neural Language Models',
    technique: 'Ensemble Scaling',
    icon: '📈',
    tag: 'Ensemble',
    color: '#f97316',
    year: 2020,
  },
  ronneberger2015: {
    paperTitle: 'U-Net: Convolutional Networks for Biomedical Image Segmentation',
    technique: 'Bagging Augmentation',
    icon: '🎒',
    tag: 'Bagging',
    color: '#14b8a6',
    year: 2015,
  },
  lewis2020: {
    paperTitle: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    technique: 'KNN Features',
    icon: '🔎',
    tag: 'Imputation',
    color: '#0ea5e9',
    year: 2020,
  },
};

export function getPaperInfo(paperId) {
  return PAPER_TECHNIQUE_MAP[paperId] || {
    paperTitle: paperId,
    technique: paperId,
    icon: '📄',
    tag: 'Unknown',
    color: '#6b7280',
    year: null,
  };
}

export function getPaperIcon(paperId) {
  return (PAPER_TECHNIQUE_MAP[paperId] || {}).icon || '📄';
}

export function getPaperColor(paperId) {
  return (PAPER_TECHNIQUE_MAP[paperId] || {}).color || '#6b7280';
}

export default PAPER_TECHNIQUE_MAP;
