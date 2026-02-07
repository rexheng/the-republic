#!/usr/bin/env python3
"""
Paper Registry — Maps 50 seed papers to concrete sklearn experiments.

Each paper has a technique translation: the paper's key idea → a sklearn pipeline
that implements an analogous strategy for tabular ML.
"""

import numpy as np
from sklearn.linear_model import LogisticRegression, Ridge, Lasso
from sklearn.ensemble import (
    GradientBoostingClassifier, GradientBoostingRegressor,
    RandomForestClassifier, RandomForestRegressor,
    BaggingClassifier, BaggingRegressor,
    VotingClassifier, VotingRegressor,
    ExtraTreesClassifier, ExtraTreesRegressor,
)
from sklearn.preprocessing import (
    StandardScaler, QuantileTransformer, PolynomialFeatures,
)
from sklearn.decomposition import PCA
from sklearn.feature_selection import SelectKBest, mutual_info_classif, mutual_info_regression, SelectFromModel
from sklearn.impute import KNNImputer, SimpleImputer
from sklearn.model_selection import RandomizedSearchCV
from sklearn.pipeline import Pipeline


# ─── Context Builder ───────────────────────────────────────

def build_dataset_context(analysis):
    """Parse analysis.json dict into a context dict for paper matching."""
    meta = analysis.get('_meta', {})
    train_file = meta.get('train_file')
    train_info = analysis.get(train_file, {}) if train_file else {}

    cols_info = train_info.get('columns_info', {})
    target_col = meta.get('target_column')

    # Count feature types (excluding target)
    feature_cols = {k: v for k, v in cols_info.items() if k != target_col}
    num_features = len(feature_cols)
    numeric_count = sum(
        1 for v in feature_cols.values()
        if v.get('feature_type') in ('continuous', 'discrete')
    )
    categorical_count = sum(
        1 for v in feature_cols.values()
        if v.get('feature_type') in ('categorical', 'high_cardinality')
    )
    missing_cols = [
        k for k, v in feature_cols.items()
        if v.get('missing_pct', 0) > 5
    ]

    # Class imbalance
    class_balance = meta.get('class_balance', {})
    imbalance_ratio = 1.0
    if class_balance and len(class_balance) >= 2:
        counts = list(class_balance.values())
        if isinstance(counts[0], (int, float)):
            imbalance_ratio = max(counts) / max(min(counts), 1)

    # Problem type
    target_info = cols_info.get(target_col, {})
    unique = target_info.get('unique', 0)
    dtype = target_info.get('dtype', '')
    if unique <= 20 and dtype in ['int64', 'object', 'bool']:
        problem_type = 'classification'
    else:
        problem_type = 'regression'

    train_rows = train_info.get('rows', 0)

    return {
        'problem_type': problem_type,
        'train_rows': train_rows,
        'num_features': num_features,
        'numeric_count': numeric_count,
        'categorical_count': categorical_count,
        'numeric_ratio': numeric_count / max(num_features, 1),
        'has_categoricals': categorical_count > 0,
        'has_missing': len(missing_cols) > 0,
        'missing_columns': missing_cols,
        'class_imbalance_ratio': imbalance_ratio,
        'target_column': target_col,
        'train_file': train_file,
    }


# ─── Paper Registry ────────────────────────────────────────

PAPER_REGISTRY = [
    {
        'paper_id': 'srivastava2014',
        'paper_title': 'Dropout: A Simple Way to Prevent Neural Networks from Overfitting',
        'technique': 'Dropout Regularization',
        'description': 'Strong L2 regularization mimics dropout for tabular models',
        'relevance_fn': lambda ctx: ctx['train_rows'] < 5000 or ctx['num_features'] > 15,
        'relevance_reason': lambda ctx: f"Small dataset ({ctx['train_rows']} rows)" if ctx['train_rows'] < 5000 else f"Many features ({ctx['num_features']})",
        'build_pipeline': lambda ctx: _build_regularization(ctx),
    },
    {
        'paper_id': 'ioffe2015',
        'paper_title': 'Batch Normalization: Accelerating Deep Network Training',
        'technique': 'Aggressive Scaling',
        'description': 'QuantileTransformer normalizes feature distributions like BatchNorm',
        'relevance_fn': lambda ctx: ctx['numeric_ratio'] > 0.5,
        'relevance_reason': lambda ctx: f"High numeric ratio ({ctx['numeric_ratio']:.0%})",
        'build_pipeline': lambda ctx: _build_quantile_gbm(ctx),
    },
    {
        'paper_id': 'kingma2015',
        'paper_title': 'Adam: A Method for Stochastic Optimization',
        'technique': 'Adaptive LR GBM',
        'description': 'Low learning rate + many estimators mirrors adaptive optimization',
        'relevance_fn': lambda ctx: True,
        'relevance_reason': lambda ctx: 'Universal baseline — adaptive learning rate GBM',
        'build_pipeline': lambda ctx: _build_adam_gbm(ctx),
    },
    {
        'paper_id': 'he2016',
        'paper_title': 'Deep Residual Learning for Image Recognition',
        'technique': 'Residual Features',
        'description': 'Pairwise interaction features act as residual connections',
        'relevance_fn': lambda ctx: ctx['numeric_count'] >= 2,
        'relevance_reason': lambda ctx: f"{ctx['numeric_count']} numeric columns for interaction features",
        'build_pipeline': lambda ctx: _build_residual_features(ctx),
    },
    {
        'paper_id': 'goodfellow2014',
        'paper_title': 'Generative Adversarial Networks',
        'technique': 'Class Balancing',
        'description': 'class_weight=balanced augments minority class like GANs generate data',
        'relevance_fn': lambda ctx: ctx['problem_type'] == 'classification' and ctx['class_imbalance_ratio'] > 2,
        'relevance_reason': lambda ctx: f"Class imbalance ratio {ctx['class_imbalance_ratio']:.1f}:1",
        'build_pipeline': lambda ctx: _build_balanced_rf(ctx),
    },
    {
        'paper_id': 'mikolov2013',
        'paper_title': 'Efficient Estimation of Word Representations in Vector Space',
        'technique': 'Frequency Encoding',
        'description': 'Replace categoricals with frequency counts — word2vec for tables',
        'relevance_fn': lambda ctx: ctx['has_categoricals'],
        'relevance_reason': lambda ctx: f"Has categorical features ({ctx['categorical_count']} columns)",
        'build_pipeline': lambda ctx: _build_frequency_gbm(ctx),
    },
    {
        'paper_id': 'hinton2006',
        'paper_title': 'Reducing the Dimensionality of Data with Neural Networks',
        'technique': 'PCA Reduction',
        'description': 'PCA compresses features like autoencoders learn compressed representations',
        'relevance_fn': lambda ctx: ctx['numeric_count'] > 10,
        'relevance_reason': lambda ctx: f"Many numeric features ({ctx['numeric_count']}) — PCA compression",
        'build_pipeline': lambda ctx: _build_pca_gbm(ctx),
    },
    {
        'paper_id': 'vaswani2017',
        'paper_title': 'Attention Is All You Need',
        'technique': 'Feature Selection',
        'description': 'SelectKBest with mutual info focuses on most important features like attention',
        'relevance_fn': lambda ctx: ctx['num_features'] > 5,
        'relevance_reason': lambda ctx: f"{ctx['num_features']} features — select most informative",
        'build_pipeline': lambda ctx: _build_attention_select(ctx),
    },
    {
        'paper_id': 'kipf2017',
        'paper_title': 'Semi-Supervised Classification with Graph Convolutional Networks',
        'technique': 'Pseudo-Labeling',
        'description': 'Train on labeled data, predict test, retrain on confident pseudo-labels',
        'relevance_fn': lambda ctx: ctx['problem_type'] == 'classification',
        'relevance_reason': lambda ctx: 'Classification task — semi-supervised pseudo-labeling',
        'build_pipeline': lambda ctx: _build_pseudo_label(ctx),
    },
    {
        'paper_id': 'zoph2017',
        'paper_title': 'Neural Architecture Search with Reinforcement Learning',
        'technique': 'Hyperparameter Search',
        'description': 'Broad RandomizedSearchCV mimics NAS over hyperparameter space',
        'relevance_fn': lambda ctx: True,
        'relevance_reason': lambda ctx: 'Universal — automated hyperparameter search',
        'build_pipeline': lambda ctx: _build_nas_search(ctx),
    },
    {
        'paper_id': 'loshchilov2019',
        'paper_title': 'Decoupled Weight Decay Regularization (AdamW)',
        'technique': 'Weight Decay + L1 Selection',
        'description': 'L1 pre-selection + subsampled GBM mirrors decoupled weight decay',
        'relevance_fn': lambda ctx: ctx['num_features'] > 5,
        'relevance_reason': lambda ctx: f"{ctx['num_features']} features — L1 pre-selection with subsample",
        'build_pipeline': lambda ctx: _build_adamw_decay(ctx),
    },
    {
        'paper_id': 'bahdanau2015',
        'paper_title': 'Neural Machine Translation by Jointly Learning to Align and Translate',
        'technique': 'Tree-based Selection',
        'description': 'ExtraTrees feature importance acts as attention over feature space',
        'relevance_fn': lambda ctx: ctx['num_features'] > 8,
        'relevance_reason': lambda ctx: f"{ctx['num_features']} features — tree-based attention selection",
        'build_pipeline': lambda ctx: _build_tree_select(ctx),
    },
    {
        'paper_id': 'kaplan2020',
        'paper_title': 'Scaling Laws for Neural Language Models',
        'technique': 'Ensemble Scaling',
        'description': 'VotingClassifier/Regressor scales predictions across diverse models',
        'relevance_fn': lambda ctx: True,
        'relevance_reason': lambda ctx: 'Universal — ensemble of diverse models',
        'build_pipeline': lambda ctx: _build_ensemble(ctx),
    },
    {
        'paper_id': 'ronneberger2015',
        'paper_title': 'U-Net: Convolutional Networks for Biomedical Image Segmentation',
        'technique': 'Bagging Augmentation',
        'description': 'BaggingClassifier with subsampling augments small datasets like U-Net augmentation',
        'relevance_fn': lambda ctx: ctx['train_rows'] < 5000,
        'relevance_reason': lambda ctx: f"Small dataset ({ctx['train_rows']} rows) — bagging augmentation",
        'build_pipeline': lambda ctx: _build_bagging(ctx),
    },
    {
        'paper_id': 'lewis2020',
        'paper_title': 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
        'technique': 'KNN Features',
        'description': 'KNN imputation + distance features retrieves info from nearest neighbors',
        'relevance_fn': lambda ctx: ctx['has_missing'],
        'relevance_reason': lambda ctx: f"Missing values in {len(ctx['missing_columns'])} columns",
        'build_pipeline': lambda ctx: _build_knn_features(ctx),
    },
]


# ─── Pipeline Builders ─────────────────────────────────────

def _gbm(ctx, **kwargs):
    """Create a GBM with sensible defaults."""
    defaults = {'n_estimators': 200, 'max_depth': 4, 'learning_rate': 0.1,
                'subsample': 0.8, 'random_state': 42}
    defaults.update(kwargs)
    if ctx['problem_type'] == 'classification':
        return GradientBoostingClassifier(**defaults)
    return GradientBoostingRegressor(**defaults)


def _build_regularization(ctx):
    if ctx['problem_type'] == 'classification':
        model = LogisticRegression(C=0.1, penalty='l2', max_iter=1000, solver='lbfgs', random_state=42)
    else:
        model = Ridge(alpha=10.0, random_state=42)
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler()),
        ('model', model),
    ])


def _build_quantile_gbm(ctx):
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', QuantileTransformer(output_distribution='normal', random_state=42)),
        ('model', _gbm(ctx)),
    ])


def _build_adam_gbm(ctx):
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('model', _gbm(ctx, learning_rate=0.01, n_estimators=500, subsample=0.8)),
    ])


def _build_residual_features(ctx):
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('interactions', PolynomialFeatures(degree=2, interaction_only=True, include_bias=False)),
        ('model', _gbm(ctx)),
    ])


def _build_balanced_rf(ctx):
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('model', RandomForestClassifier(
            n_estimators=200, class_weight='balanced', max_depth=6, random_state=42
        )),
    ])


def _build_frequency_gbm(ctx):
    # Frequency encoding is done in preprocessing, not the pipeline
    # The pipeline just uses GBM on already-encoded features
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('model', _gbm(ctx)),
    ])


def _build_pca_gbm(ctx):
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler()),
        ('pca', PCA(n_components=0.95, random_state=42)),
        ('model', _gbm(ctx)),
    ])


def _build_attention_select(ctx):
    k = min(ctx['num_features'], max(5, ctx['num_features'] // 2))
    if ctx['problem_type'] == 'classification':
        score_func = mutual_info_classif
    else:
        score_func = mutual_info_regression
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('select', SelectKBest(score_func=score_func, k=k)),
        ('model', _gbm(ctx)),
    ])


def _build_pseudo_label(ctx):
    # Pseudo-labeling is handled specially in the runner, not as a pipeline
    # Return a standard GBM that the runner will wrap with pseudo-label logic
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('model', GradientBoostingClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.1,
            subsample=0.8, random_state=42
        )),
    ])


def _build_nas_search(ctx):
    # Returns the base estimator — the runner wraps it in RandomizedSearchCV
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('model', _gbm(ctx)),
    ])


def _build_adamw_decay(ctx):
    if ctx['problem_type'] == 'classification':
        selector = SelectFromModel(
            Lasso(alpha=0.01, random_state=42, max_iter=2000),
            max_features=max(5, ctx['num_features'] // 2)
        )
    else:
        selector = SelectFromModel(
            Lasso(alpha=0.01, random_state=42, max_iter=2000),
            max_features=max(5, ctx['num_features'] // 2)
        )
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler()),
        ('selector', selector),
        ('model', _gbm(ctx, subsample=0.7)),
    ])


def _build_tree_select(ctx):
    if ctx['problem_type'] == 'classification':
        selector_est = ExtraTreesClassifier(n_estimators=100, random_state=42)
    else:
        selector_est = ExtraTreesRegressor(n_estimators=100, random_state=42)
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('selector', SelectFromModel(selector_est, max_features=max(5, ctx['num_features'] // 2))),
        ('model', _gbm(ctx)),
    ])


def _build_ensemble(ctx):
    if ctx['problem_type'] == 'classification':
        return VotingClassifier(
            estimators=[
                ('lr', Pipeline([
                    ('imputer', SimpleImputer(strategy='median')),
                    ('scaler', StandardScaler()),
                    ('model', LogisticRegression(max_iter=1000, random_state=42)),
                ])),
                ('rf', Pipeline([
                    ('imputer', SimpleImputer(strategy='median')),
                    ('model', RandomForestClassifier(n_estimators=150, max_depth=5, random_state=42)),
                ])),
                ('gbm', Pipeline([
                    ('imputer', SimpleImputer(strategy='median')),
                    ('model', GradientBoostingClassifier(n_estimators=200, max_depth=4, random_state=42)),
                ])),
            ],
            voting='hard',
        )
    else:
        return VotingRegressor(
            estimators=[
                ('ridge', Pipeline([
                    ('imputer', SimpleImputer(strategy='median')),
                    ('scaler', StandardScaler()),
                    ('model', Ridge(alpha=1.0, random_state=42)),
                ])),
                ('rf', Pipeline([
                    ('imputer', SimpleImputer(strategy='median')),
                    ('model', RandomForestRegressor(n_estimators=150, max_depth=5, random_state=42)),
                ])),
                ('gbm', Pipeline([
                    ('imputer', SimpleImputer(strategy='median')),
                    ('model', GradientBoostingRegressor(n_estimators=200, max_depth=4, random_state=42)),
                ])),
            ],
        )


def _build_bagging(ctx):
    if ctx['problem_type'] == 'classification':
        return Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('model', BaggingClassifier(
                n_estimators=20, max_samples=0.7, random_state=42
            )),
        ])
    return Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('model', BaggingRegressor(
            n_estimators=20, max_samples=0.7, random_state=42
        )),
    ])


def _build_knn_features(ctx):
    return Pipeline([
        ('imputer', KNNImputer(n_neighbors=5)),
        ('model', _gbm(ctx)),
    ])


# ─── Matching Engine ───────────────────────────────────────

def find_relevant_papers(context, max_papers=8):
    """Match papers to dataset characteristics. Cap at max_papers.

    Specific matches (not always-true) are sorted first, then universal ones.
    """
    specific = []
    universal = []

    for entry in PAPER_REGISTRY:
        if entry['relevance_fn'](context):
            reason = entry['relevance_reason'](context)
            match = {
                'paper_id': entry['paper_id'],
                'paper_title': entry['paper_title'],
                'technique': entry['technique'],
                'description': entry['description'],
                'reason': reason,
            }
            # Check if always-true (universal)
            is_universal = entry['relevance_fn']({'problem_type': 'classification',
                                                   'train_rows': 10000,
                                                   'num_features': 3,
                                                   'numeric_count': 1,
                                                   'categorical_count': 0,
                                                   'numeric_ratio': 0.33,
                                                   'has_categoricals': False,
                                                   'has_missing': False,
                                                   'missing_columns': [],
                                                   'class_imbalance_ratio': 1.0,
                                                   'target_column': 'y',
                                                   'train_file': 'train.csv'})
            if is_universal:
                universal.append(match)
            else:
                specific.append(match)

    # Specific matches first, then universal, capped
    return (specific + universal)[:max_papers]


def get_paper_entry(paper_id):
    """Get a paper registry entry by ID."""
    for entry in PAPER_REGISTRY:
        if entry['paper_id'] == paper_id:
            return entry
    return None


def build_experiment_pipeline(paper_entry, context):
    """Build a sklearn Pipeline from a paper entry + dataset context."""
    pipeline = paper_entry['build_pipeline'](context)
    return {
        'pipeline': pipeline,
        'paper_id': paper_entry['paper_id'],
        'paper_title': paper_entry['paper_title'],
        'technique': paper_entry['technique'],
        'description': paper_entry['description'],
    }
