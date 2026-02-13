// Pyodide Web Worker for browser-native Kaggle Lab
// Runs pandas, numpy, scikit-learn entirely in the browser via WebAssembly.
//
// Messages IN:  { type: 'init' | 'analyze' | 'runExperiments', ... }
// Messages OUT: { type: 'progress' | 'ready' | 'event' | 'result' | 'error', ... }

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.27.3/full/';

let pyodide = null;
let packagesLoaded = false;

// ─── Python source code (adapted for Pyodide) ──────────────

const DATA_ANALYZER_PY = `
import pandas as pd
import numpy as np
import json
import os

def classify_feature(series):
    if series.dtype == 'object' or series.dtype.name == 'category':
        if series.nunique() > 50:
            return 'high_cardinality'
        return 'categorical'
    if series.dtype in ['int64', 'int32']:
        if series.nunique() <= 20:
            return 'discrete'
    if series.dtype in ['float64', 'float32', 'int64', 'int32']:
        return 'continuous'
    return 'other'

def analyze_csv(file_path):
    df = pd.read_csv(file_path)
    columns_info = {}
    for col in df.columns:
        dtype = df[col].dtype
        missing = int(df[col].isna().sum())
        missing_pct = (missing / len(df)) * 100
        unique = int(df[col].nunique())
        feature_type = classify_feature(df[col])
        info = {
            'dtype': str(dtype), 'missing': missing,
            'missing_pct': round(missing_pct, 1), 'unique': unique,
            'feature_type': feature_type
        }
        if dtype in ['int64', 'float64'] and unique > 2:
            info['min'] = float(df[col].min()) if not pd.isna(df[col].min()) else None
            info['max'] = float(df[col].max()) if not pd.isna(df[col].max()) else None
            info['mean'] = float(df[col].mean()) if not pd.isna(df[col].mean()) else None
            info['std'] = float(df[col].std()) if not pd.isna(df[col].std()) else None
        if dtype == 'object' and unique <= 20:
            info['value_counts'] = df[col].value_counts().head(10).to_dict()
        columns_info[col] = info

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    correlation = {}
    if len(numeric_cols) >= 2:
        corr_matrix = df[numeric_cols].corr()
        for i, c1 in enumerate(numeric_cols):
            for c2 in numeric_cols[i+1:]:
                val = corr_matrix.loc[c1, c2]
                if not pd.isna(val) and abs(val) > 0.3:
                    correlation[f"{c1}_vs_{c2}"] = round(float(val), 3)

    missing_pattern = {}
    for col in df.columns:
        m = int(df[col].isna().sum())
        if m > 0:
            missing_pattern[col] = {'count': m, 'pct': round((m / len(df)) * 100, 1)}

    return {
        'file': os.path.basename(file_path),
        'rows': int(df.shape[0]), 'columns': int(df.shape[1]),
        'column_names': list(df.columns), 'columns_info': columns_info,
        'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
        'missing': {col: int(df[col].isna().sum()) for col in df.columns},
        'missing_pattern': missing_pattern, 'correlation': correlation,
        'sample': df.head(3).to_dict('records')
    }

def detect_target(train_info, test_info):
    id_names = {'id', 'Id', 'ID', 'PassengerId'}
    train_cols = set(train_info['column_names'])
    test_cols = set(test_info['column_names'])
    candidates = train_cols - test_cols - id_names
    if len(candidates) == 1:
        return list(candidates)[0]
    for col in train_info['column_names']:
        if col in candidates:
            return col
    return None

def analyze_dataset(data_dir, competition_name):
    csv_files = [f for f in os.listdir(data_dir) if f.endswith('.csv')]
    if not csv_files:
        return None

    analysis_results = {}
    for csv_file in csv_files:
        result = analyze_csv(os.path.join(data_dir, csv_file))
        if result:
            analysis_results[csv_file] = result

    train_file = next((f for f in csv_files if 'train' in f.lower()), None)
    test_file = next((f for f in csv_files if 'test' in f.lower()), None)

    target_col = None
    class_balance = None
    recommendations = []

    if train_file and test_file and train_file in analysis_results and test_file in analysis_results:
        target_col = detect_target(analysis_results[train_file], analysis_results[test_file])
        if target_col:
            target_info = analysis_results[train_file]['columns_info'].get(target_col, {})
            if target_info.get('value_counts'):
                class_balance = target_info['value_counts']

    # Compute feature stats
    numeric_ratio = 0.0
    has_categoricals = False
    has_missing = False
    missing_columns = []
    num_features = 0

    if train_file and train_file in analysis_results:
        tr = analysis_results[train_file]
        cols = tr.get('columns_info', {})
        feature_cols = {k: v for k, v in cols.items() if k != target_col}
        num_features = len(feature_cols)
        numeric_count = sum(1 for v in feature_cols.values() if v.get('feature_type') in ('continuous', 'discrete'))
        cat_count = sum(1 for v in feature_cols.values() if v.get('feature_type') in ('categorical', 'high_cardinality'))
        numeric_ratio = numeric_count / max(num_features, 1)
        has_categoricals = cat_count > 0
        missing_columns = [k for k, v in feature_cols.items() if v.get('missing_pct', 0) > 5]
        has_missing = len(missing_columns) > 0

    analysis_results['_meta'] = {
        'competition': competition_name,
        'train_file': train_file, 'test_file': test_file,
        'target_column': target_col, 'class_balance': class_balance,
        'recommendations': recommendations,
        'numeric_ratio': round(numeric_ratio, 3),
        'has_categoricals': has_categoricals,
        'has_missing': has_missing,
        'missing_columns': missing_columns,
        'num_features': num_features,
    }

    analysis_path = os.path.join(data_dir, 'analysis.json')
    with open(analysis_path, 'w') as f:
        json.dump(analysis_results, f, indent=2, default=str)

    return analysis_results
`;

const PAPER_REGISTRY_PY = `
import numpy as np
from sklearn.linear_model import LogisticRegression, Ridge, Lasso
from sklearn.ensemble import (
    GradientBoostingClassifier, GradientBoostingRegressor,
    RandomForestClassifier, RandomForestRegressor,
    BaggingClassifier, BaggingRegressor,
    VotingClassifier, VotingRegressor,
    ExtraTreesClassifier, ExtraTreesRegressor,
)
from sklearn.preprocessing import StandardScaler, QuantileTransformer, PolynomialFeatures
from sklearn.decomposition import PCA
from sklearn.feature_selection import SelectKBest, mutual_info_classif, mutual_info_regression, SelectFromModel
from sklearn.impute import KNNImputer, SimpleImputer
from sklearn.model_selection import RandomizedSearchCV
from sklearn.pipeline import Pipeline

def build_dataset_context(analysis):
    meta = analysis.get('_meta', {})
    train_file = meta.get('train_file')
    train_info = analysis.get(train_file, {}) if train_file else {}
    cols_info = train_info.get('columns_info', {})
    target_col = meta.get('target_column')
    feature_cols = {k: v for k, v in cols_info.items() if k != target_col}
    num_features = len(feature_cols)
    numeric_count = sum(1 for v in feature_cols.values() if v.get('feature_type') in ('continuous', 'discrete'))
    categorical_count = sum(1 for v in feature_cols.values() if v.get('feature_type') in ('categorical', 'high_cardinality'))
    missing_cols = [k for k, v in feature_cols.items() if v.get('missing_pct', 0) > 5]
    class_balance = meta.get('class_balance', {})
    imbalance_ratio = 1.0
    if class_balance and len(class_balance) >= 2:
        counts = list(class_balance.values())
        if isinstance(counts[0], (int, float)):
            imbalance_ratio = max(counts) / max(min(counts), 1)
    target_info = cols_info.get(target_col, {})
    unique = target_info.get('unique', 0)
    dtype = target_info.get('dtype', '')
    if unique <= 20 and (dtype in ['int64', 'object', 'bool', 'str', 'string', 'category'] or 'str' in dtype):
        problem_type = 'classification'
    else:
        problem_type = 'regression'
    train_rows = train_info.get('rows', 0)
    return {
        'problem_type': problem_type, 'train_rows': train_rows,
        'num_features': num_features, 'numeric_count': numeric_count,
        'categorical_count': categorical_count,
        'numeric_ratio': numeric_count / max(num_features, 1),
        'has_categoricals': categorical_count > 0,
        'has_missing': len(missing_cols) > 0,
        'missing_columns': missing_cols,
        'class_imbalance_ratio': imbalance_ratio,
        'target_column': target_col, 'train_file': train_file,
    }

def _gbm(ctx, **kwargs):
    defaults = {'n_estimators': 200, 'max_depth': 4, 'learning_rate': 0.1, 'subsample': 0.8, 'random_state': 42}
    defaults.update(kwargs)
    if ctx['problem_type'] == 'classification':
        return GradientBoostingClassifier(**defaults)
    return GradientBoostingRegressor(**defaults)

def _build_regularization(ctx):
    if ctx['problem_type'] == 'classification':
        model = LogisticRegression(C=0.1, penalty='l2', max_iter=1000, solver='lbfgs', random_state=42)
    else:
        model = Ridge(alpha=10.0)
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler()), ('model', model)])

def _build_quantile_gbm(ctx):
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', QuantileTransformer(output_distribution='normal', random_state=42)), ('model', _gbm(ctx))])

def _build_adam_gbm(ctx):
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', _gbm(ctx, learning_rate=0.01, n_estimators=500, subsample=0.8))])

def _build_residual_features(ctx):
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('interactions', PolynomialFeatures(degree=2, interaction_only=True, include_bias=False)), ('model', _gbm(ctx))])

def _build_balanced_rf(ctx):
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', RandomForestClassifier(n_estimators=200, class_weight='balanced', max_depth=6, random_state=42, n_jobs=1))])

def _build_frequency_gbm(ctx):
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', _gbm(ctx))])

def _build_pca_gbm(ctx):
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler()), ('pca', PCA(n_components=0.95, random_state=42)), ('model', _gbm(ctx))])

def _build_attention_select(ctx):
    k = min(ctx['num_features'], max(5, ctx['num_features'] // 2))
    score_func = mutual_info_classif if ctx['problem_type'] == 'classification' else mutual_info_regression
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('select', SelectKBest(score_func=score_func, k=k)), ('model', _gbm(ctx))])

def _build_pseudo_label(ctx):
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', GradientBoostingClassifier(n_estimators=200, max_depth=4, learning_rate=0.1, subsample=0.8, random_state=42))])

def _build_nas_search(ctx):
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', _gbm(ctx))])

def _build_adamw_decay(ctx):
    selector = SelectFromModel(Lasso(alpha=0.01, random_state=42, max_iter=2000), max_features=max(5, ctx['num_features'] // 2))
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler()), ('selector', selector), ('model', _gbm(ctx, subsample=0.7))])

def _build_tree_select(ctx):
    selector_est = ExtraTreesClassifier(n_estimators=100, random_state=42, n_jobs=1) if ctx['problem_type'] == 'classification' else ExtraTreesRegressor(n_estimators=100, random_state=42, n_jobs=1)
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('selector', SelectFromModel(selector_est, max_features=max(5, ctx['num_features'] // 2))), ('model', _gbm(ctx))])

def _build_ensemble(ctx):
    if ctx['problem_type'] == 'classification':
        return VotingClassifier(estimators=[
            ('lr', Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler()), ('model', LogisticRegression(max_iter=1000, random_state=42))])),
            ('rf', Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', RandomForestClassifier(n_estimators=150, max_depth=5, random_state=42, n_jobs=1))])),
            ('gbm', Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', GradientBoostingClassifier(n_estimators=200, max_depth=4, random_state=42))])),
        ], voting='hard', n_jobs=1)
    else:
        return VotingRegressor(estimators=[
            ('ridge', Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler()), ('model', Ridge(alpha=1.0))])),
            ('rf', Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', RandomForestRegressor(n_estimators=150, max_depth=5, random_state=42, n_jobs=1))])),
            ('gbm', Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', GradientBoostingRegressor(n_estimators=200, max_depth=4, random_state=42))])),
        ], n_jobs=1)

def _build_bagging(ctx):
    if ctx['problem_type'] == 'classification':
        return Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', BaggingClassifier(n_estimators=20, max_samples=0.7, random_state=42, n_jobs=1))])
    return Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', BaggingRegressor(n_estimators=20, max_samples=0.7, random_state=42, n_jobs=1))])

def _build_knn_features(ctx):
    return Pipeline([('imputer', KNNImputer(n_neighbors=5)), ('model', _gbm(ctx))])

PAPER_REGISTRY = [
    {'paper_id': 'srivastava2014', 'paper_title': 'Dropout: A Simple Way to Prevent Neural Networks from Overfitting', 'technique': 'Dropout Regularization', 'description': 'Strong L2 regularization mimics dropout for tabular models',
     'relevance_fn': lambda ctx: ctx['train_rows'] < 5000 or ctx['num_features'] > 15,
     'relevance_reason': lambda ctx: f"Small dataset ({ctx['train_rows']} rows)" if ctx['train_rows'] < 5000 else f"Many features ({ctx['num_features']})",
     'build_pipeline': lambda ctx: _build_regularization(ctx)},
    {'paper_id': 'ioffe2015', 'paper_title': 'Batch Normalization: Accelerating Deep Network Training', 'technique': 'Aggressive Scaling', 'description': 'QuantileTransformer normalizes feature distributions like BatchNorm',
     'relevance_fn': lambda ctx: ctx['numeric_ratio'] > 0.5,
     'relevance_reason': lambda ctx: f"High numeric ratio ({ctx['numeric_ratio']:.0%})",
     'build_pipeline': lambda ctx: _build_quantile_gbm(ctx)},
    {'paper_id': 'kingma2015', 'paper_title': 'Adam: A Method for Stochastic Optimization', 'technique': 'Adaptive LR GBM', 'description': 'Low learning rate + many estimators mirrors adaptive optimization',
     'relevance_fn': lambda ctx: True,
     'relevance_reason': lambda ctx: 'Universal baseline - adaptive learning rate GBM',
     'build_pipeline': lambda ctx: _build_adam_gbm(ctx)},
    {'paper_id': 'he2016', 'paper_title': 'Deep Residual Learning for Image Recognition', 'technique': 'Residual Features', 'description': 'Pairwise interaction features act as residual connections',
     'relevance_fn': lambda ctx: ctx['numeric_count'] >= 2,
     'relevance_reason': lambda ctx: f"{ctx['numeric_count']} numeric columns for interaction features",
     'build_pipeline': lambda ctx: _build_residual_features(ctx)},
    {'paper_id': 'goodfellow2014', 'paper_title': 'Generative Adversarial Networks', 'technique': 'Class Balancing', 'description': 'class_weight=balanced augments minority class like GANs generate data',
     'relevance_fn': lambda ctx: ctx['problem_type'] == 'classification' and ctx['class_imbalance_ratio'] > 2,
     'relevance_reason': lambda ctx: f"Class imbalance ratio {ctx['class_imbalance_ratio']:.1f}:1",
     'build_pipeline': lambda ctx: _build_balanced_rf(ctx)},
    {'paper_id': 'mikolov2013', 'paper_title': 'Efficient Estimation of Word Representations in Vector Space', 'technique': 'Frequency Encoding', 'description': 'Replace categoricals with frequency counts',
     'relevance_fn': lambda ctx: ctx['has_categoricals'],
     'relevance_reason': lambda ctx: f"Has categorical features ({ctx['categorical_count']} columns)",
     'build_pipeline': lambda ctx: _build_frequency_gbm(ctx)},
    {'paper_id': 'hinton2006', 'paper_title': 'Reducing the Dimensionality of Data with Neural Networks', 'technique': 'PCA Reduction', 'description': 'PCA compresses features like autoencoders',
     'relevance_fn': lambda ctx: ctx['numeric_count'] > 10,
     'relevance_reason': lambda ctx: f"Many numeric features ({ctx['numeric_count']})",
     'build_pipeline': lambda ctx: _build_pca_gbm(ctx)},
    {'paper_id': 'vaswani2017', 'paper_title': 'Attention Is All You Need', 'technique': 'Feature Selection', 'description': 'SelectKBest with mutual info focuses on most important features',
     'relevance_fn': lambda ctx: ctx['num_features'] > 5,
     'relevance_reason': lambda ctx: f"{ctx['num_features']} features - select most informative",
     'build_pipeline': lambda ctx: _build_attention_select(ctx)},
    {'paper_id': 'kipf2017', 'paper_title': 'Semi-Supervised Classification with Graph Convolutional Networks', 'technique': 'Pseudo-Labeling', 'description': 'Train on labeled data, predict test, retrain on confident pseudo-labels',
     'relevance_fn': lambda ctx: ctx['problem_type'] == 'classification',
     'relevance_reason': lambda ctx: 'Classification task - semi-supervised pseudo-labeling',
     'build_pipeline': lambda ctx: _build_pseudo_label(ctx)},
    {'paper_id': 'zoph2017', 'paper_title': 'Neural Architecture Search with Reinforcement Learning', 'technique': 'Hyperparameter Search', 'description': 'Broad RandomizedSearchCV mimics NAS over hyperparameter space',
     'relevance_fn': lambda ctx: True,
     'relevance_reason': lambda ctx: 'Universal - automated hyperparameter search',
     'build_pipeline': lambda ctx: _build_nas_search(ctx)},
    {'paper_id': 'loshchilov2019', 'paper_title': 'Decoupled Weight Decay Regularization (AdamW)', 'technique': 'Weight Decay + L1 Selection', 'description': 'L1 pre-selection + subsampled GBM mirrors decoupled weight decay',
     'relevance_fn': lambda ctx: ctx['num_features'] > 5,
     'relevance_reason': lambda ctx: f"{ctx['num_features']} features - L1 pre-selection with subsample",
     'build_pipeline': lambda ctx: _build_adamw_decay(ctx)},
    {'paper_id': 'bahdanau2015', 'paper_title': 'Neural Machine Translation by Jointly Learning to Align and Translate', 'technique': 'Tree-based Selection', 'description': 'ExtraTrees feature importance acts as attention',
     'relevance_fn': lambda ctx: ctx['num_features'] > 8,
     'relevance_reason': lambda ctx: f"{ctx['num_features']} features - tree-based attention selection",
     'build_pipeline': lambda ctx: _build_tree_select(ctx)},
    {'paper_id': 'kaplan2020', 'paper_title': 'Scaling Laws for Neural Language Models', 'technique': 'Ensemble Scaling', 'description': 'VotingClassifier/Regressor scales predictions across diverse models',
     'relevance_fn': lambda ctx: True,
     'relevance_reason': lambda ctx: 'Universal - ensemble of diverse models',
     'build_pipeline': lambda ctx: _build_ensemble(ctx)},
    {'paper_id': 'ronneberger2015', 'paper_title': 'U-Net: Convolutional Networks for Biomedical Image Segmentation', 'technique': 'Bagging Augmentation', 'description': 'BaggingClassifier with subsampling augments small datasets',
     'relevance_fn': lambda ctx: ctx['train_rows'] < 5000,
     'relevance_reason': lambda ctx: f"Small dataset ({ctx['train_rows']} rows) - bagging augmentation",
     'build_pipeline': lambda ctx: _build_bagging(ctx)},
    {'paper_id': 'lewis2020', 'paper_title': 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks', 'technique': 'KNN Features', 'description': 'KNN imputation + distance features retrieves info from nearest neighbors',
     'relevance_fn': lambda ctx: ctx['has_missing'],
     'relevance_reason': lambda ctx: f"Missing values in {len(ctx['missing_columns'])} columns",
     'build_pipeline': lambda ctx: _build_knn_features(ctx)},
]

def find_relevant_papers(context, max_papers=8):
    specific = []
    universal = []
    dummy = {'problem_type': 'classification', 'train_rows': 10000, 'num_features': 3,
             'numeric_count': 1, 'categorical_count': 0, 'numeric_ratio': 0.33,
             'has_categoricals': False, 'has_missing': False, 'missing_columns': [],
             'class_imbalance_ratio': 1.0, 'target_column': 'y', 'train_file': 'train.csv'}
    for entry in PAPER_REGISTRY:
        if entry['relevance_fn'](context):
            reason = entry['relevance_reason'](context)
            match = {'paper_id': entry['paper_id'], 'paper_title': entry['paper_title'],
                     'technique': entry['technique'], 'description': entry['description'], 'reason': reason}
            if entry['relevance_fn'](dummy):
                universal.append(match)
            else:
                specific.append(match)
    return (specific + universal)[:max_papers]

def get_paper_entry(paper_id):
    for entry in PAPER_REGISTRY:
        if entry['paper_id'] == paper_id:
            return entry
    return None

def build_experiment_pipeline(paper_entry, context):
    pipeline = paper_entry['build_pipeline'](context)
    return {'pipeline': pipeline, 'paper_id': paper_entry['paper_id'],
            'paper_title': paper_entry['paper_title'], 'technique': paper_entry['technique'],
            'description': paper_entry['description']}
`;

const EXPERIMENT_RUNNER_PY = `
import json
import os
import warnings
import numpy as np
import pandas as pd
from sklearn.model_selection import cross_val_score, RandomizedSearchCV
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

warnings.filterwarnings('ignore')

# emit_event is injected from JS as a global
def emit(event_dict):
    emit_event(json.dumps(event_dict))

def find_id_column(df):
    for col in ['PassengerId', 'Id', 'id', 'ID']:
        if col in df.columns:
            return col
    return None

def find_target_column(train_df, test_df):
    id_names = {'id', 'Id', 'ID', 'PassengerId', 'passangerid'}
    for col in train_df.columns:
        if col not in test_df.columns and col not in id_names:
            return col
    return None

def basic_preprocess(train_df, test_df, target_col, frequency_encode=False):
    X_train = train_df.drop(columns=[target_col])
    y_train = train_df[target_col]
    X_test = test_df.copy()
    if not pd.api.types.is_numeric_dtype(y_train):
        target_le = LabelEncoder()
        y_train = pd.Series(target_le.fit_transform(y_train), name=y_train.name)
    id_col = find_id_column(X_test)
    test_ids = X_test[id_col].copy() if id_col else None
    if id_col:
        X_train = X_train.drop(columns=[id_col], errors='ignore')
        X_test = X_test.drop(columns=[id_col])
    common_cols = sorted(set(X_train.columns) & set(X_test.columns))
    X_train = X_train[common_cols].copy()
    X_test = X_test[common_cols].copy()
    drop_cols = [col for col in X_train.columns if X_train[col].dtype == 'object' and X_train[col].nunique() > 50]
    X_train = X_train.drop(columns=drop_cols)
    X_test = X_test.drop(columns=drop_cols)
    for col in X_train.columns:
        if X_train[col].dtype == 'object' or X_train[col].dtype.name == 'string' or not pd.api.types.is_numeric_dtype(X_train[col]):
            if frequency_encode:
                freq = X_train[col].value_counts(normalize=True).to_dict()
                X_train[col] = X_train[col].map(freq).fillna(0.0)
                X_test[col] = X_test[col].map(freq).fillna(0.0)
            else:
                X_train[col] = X_train[col].fillna('_missing_')
                X_test[col] = X_test[col].fillna('_missing_')
                le = LabelEncoder()
                le.fit(list(set(X_train[col].tolist() + X_test[col].tolist())))
                X_train[col] = le.transform(X_train[col])
                X_test[col] = le.transform(X_test[col])
        else:
            median_val = X_train[col].median()
            X_train[col] = X_train[col].fillna(median_val)
            X_test[col] = X_test[col].fillna(median_val)
    return X_train, y_train, X_test, test_ids, id_col

def run_pseudo_label_experiment(pipeline, X_train, y_train, X_test, problem_type, scoring):
    pipeline.fit(X_train, y_train)
    test_proba = pipeline.predict_proba(X_test) if hasattr(pipeline, 'predict_proba') else None
    if test_proba is not None:
        max_proba = test_proba.max(axis=1)
        confident_mask = max_proba > 0.9
        n_confident = confident_mask.sum()
        if n_confident > 10:
            pseudo_labels = pipeline.predict(X_test)
            X_pseudo = X_test[confident_mask]
            y_pseudo = pseudo_labels[confident_mask]
            X_combined = pd.concat([X_train, X_pseudo], ignore_index=True)
            y_combined = pd.concat([y_train, pd.Series(y_pseudo)], ignore_index=True)
            cv_scores = cross_val_score(pipeline, X_combined, y_combined, cv=5, scoring=scoring, n_jobs=1)
            pipeline.fit(X_combined, y_combined)
            preds = pipeline.predict(X_test)
            return cv_scores, preds, f"Pseudo-labeled {n_confident} samples"
    cv_scores = cross_val_score(pipeline, X_train, y_train, cv=5, scoring=scoring, n_jobs=1)
    pipeline.fit(X_train, y_train)
    preds = pipeline.predict(X_test)
    return cv_scores, preds, "Standard training (pseudo-labeling not confident enough)"

def run_nas_experiment(pipeline, X_train, y_train, X_test, context, scoring):
    param_dist = {
        'model__n_estimators': [100, 200, 300, 500],
        'model__max_depth': [3, 4, 5, 6, 7],
        'model__learning_rate': [0.01, 0.05, 0.1, 0.15],
        'model__subsample': [0.6, 0.7, 0.8, 0.9, 1.0],
        'model__min_samples_split': [2, 5, 10],
        'model__min_samples_leaf': [1, 2, 4],
    }
    search = RandomizedSearchCV(pipeline, param_dist, n_iter=15, cv=3,
                                scoring=scoring, random_state=42, n_jobs=1)
    search.fit(X_train, y_train)
    cv_scores = np.array([search.best_score_])
    std = float(search.cv_results_['std_test_score'][search.best_index_])
    preds = search.predict(X_test)
    params_str = json.dumps({k.replace('model__', ''): v for k, v in search.best_params_.items()})
    return cv_scores, std, preds, f"Best params: {params_str}"

def build_knowledge_graph(competition, matched_papers, results, baseline_score, best_score):
    nodes = []
    edges = []
    for match in matched_papers:
        paper_node_id = f"paper:{match['paper_id']}"
        tech_node_id = f"tech:{match['paper_id']}"
        is_ai = match.get('source') == 'ai'
        nodes.append({'id': paper_node_id, 'type': 'paper', 'label': f"{match['paper_title'][:40]}...", 'paper_id': match['paper_id'],
                      **({"ai_suggested": True} if is_ai else {})})
        nodes.append({'id': tech_node_id, 'type': 'technique', 'label': match['technique'],
                      **({"ai_suggested": True} if is_ai else {})})
        edges.append({'source': paper_node_id, 'target': tech_node_id, 'type': 'inspires'})
    for r in results:
        result_node_id = f"result:{r['id']}"
        tech_node_id = f"tech:{r['paper_id']}"
        is_winner = r.get('is_winner', False)
        status = 'proven' if r['cv_score'] > baseline_score else 'unproven'
        if is_winner:
            status = 'winner'
        nodes.append({'id': result_node_id, 'type': 'result', 'cv_score': r['cv_score'], 'status': status,
                      'is_winner': is_winner, 'label': f"CV={r['cv_score']:.4f}"})
        edges.append({'source': tech_node_id, 'target': result_node_id, 'type': 'produces'})
    proven_count = sum(1 for n in nodes if n.get('status') in ('proven', 'winner'))
    unproven_count = sum(1 for n in nodes if n.get('status') == 'unproven')
    return {'competition': competition, 'nodes': nodes, 'edges': edges,
            'baseline_score': round(baseline_score, 4), 'best_score': round(best_score, 4),
            'proven': proven_count, 'unproven': unproven_count}

AI_STRATEGY_MAP = {
    'gradient_boosting': 'kingma2015', 'random_forest': 'goodfellow2014',
    'logistic_regression': 'srivastava2014', 'ensemble': 'kaplan2020',
    'feature_selection': 'vaswani2017', 'pca': 'hinton2006',
    'hyperparameter_search': 'zoph2017',
}

def run_experiments(data_dir, competition, ai_suggestions_json=None):
    analysis_path = os.path.join(data_dir, 'analysis.json')
    with open(analysis_path, 'r') as f:
        analysis = json.load(f)

    context = build_dataset_context(analysis)

    csv_files = [f for f in os.listdir(data_dir) if f.endswith('.csv')]
    train_file = next((f for f in csv_files if 'train' in f.lower()), None)
    test_file = next((f for f in csv_files if 'test' in f.lower()), None)
    if not train_file or not test_file:
        emit({"event": "error", "message": "Could not find train.csv and test.csv"})
        return None

    train_df = pd.read_csv(os.path.join(data_dir, train_file))
    test_df = pd.read_csv(os.path.join(data_dir, test_file))
    target_col = find_target_column(train_df, test_df)
    if not target_col:
        emit({"event": "error", "message": "Could not detect target column"})
        return None

    problem_type = context['problem_type']
    scoring = 'accuracy' if problem_type == 'classification' else 'neg_root_mean_squared_error'

    emit({"event": "pipeline_start", "competition": competition,
          "train_rows": int(len(train_df)), "test_rows": int(len(test_df)),
          "target": target_col, "problem_type": problem_type})

    emit({"event": "paper_search_start", "message": "Searching papers for relevant techniques..."})
    matched_papers = find_relevant_papers(context, max_papers=8)

    # Merge AI suggestions if provided
    if ai_suggestions_json:
        try:
            ai_suggestions = json.loads(ai_suggestions_json) if isinstance(ai_suggestions_json, str) else ai_suggestions_json
            existing_ids = {m['paper_id'] for m in matched_papers}
            for suggestion in ai_suggestions:
                strategy = suggestion.get('sklearn_strategy', '')
                mapped_id = AI_STRATEGY_MAP.get(strategy)
                if not mapped_id or mapped_id in existing_ids:
                    continue
                matched_papers.append({
                    'paper_id': mapped_id,
                    'paper_title': suggestion.get('paper_title', f'AI: {strategy}'),
                    'technique': suggestion.get('technique', strategy),
                    'reason': suggestion.get('reason', 'AI-suggested technique'),
                    'source': 'ai',
                })
                existing_ids.add(mapped_id)
                emit({"event": "paper_matched", "paper_id": f"ai_{suggestion.get('paper_id', strategy)}",
                      "paper_title": suggestion.get('paper_title', ''),
                      "technique": suggestion.get('technique', strategy),
                      "reason": suggestion.get('reason', ''), "source": "ai"})
        except Exception as e:
            emit({"event": "log", "message": f"Could not parse AI suggestions: {str(e)[:100]}"})

    for match in matched_papers:
        if match.get('source') != 'ai':
            emit({"event": "paper_matched", "paper_id": match['paper_id'],
                  "paper_title": match['paper_title'], "technique": match['technique'],
                  "reason": match['reason']})

    emit({"event": "paper_search_done", "matched": len(matched_papers), "total": 15})

    results = []
    baseline_score = None

    for idx, match in enumerate(matched_papers, 1):
        paper_id = match['paper_id']
        paper_entry = get_paper_entry(paper_id)
        if paper_entry is None:
            continue
        try:
            use_freq = paper_id == 'mikolov2013'
            X_train, y_train, X_test, test_ids, id_col = basic_preprocess(train_df, test_df, target_col, frequency_encode=use_freq)
            experiment_info = build_experiment_pipeline(paper_entry, context)
            pipeline = experiment_info['pipeline']
            emit({"event": "experiment_start", "id": idx, "paper_id": paper_id,
                  "paper_title": match['paper_title'], "technique": match['technique'],
                  "strategy": experiment_info['description']})
            extra_info = ""

            if paper_id == 'kipf2017':
                cv_scores, preds, extra_info = run_pseudo_label_experiment(pipeline, X_train, y_train, X_test, problem_type, scoring)
                mean_score = float(np.mean(cv_scores))
                std_score = float(np.std(cv_scores))
            elif paper_id == 'zoph2017':
                cv_scores, std_score, preds, extra_info = run_nas_experiment(pipeline, X_train, y_train, X_test, context, scoring)
                mean_score = float(np.mean(cv_scores))
            elif paper_id == 'kaplan2020':
                ensemble = pipeline
                cv_scores = cross_val_score(ensemble, X_train, y_train, cv=5, scoring=scoring, n_jobs=1)
                mean_score = float(np.mean(cv_scores))
                std_score = float(np.std(cv_scores))
                ensemble.fit(X_train, y_train)
                preds = ensemble.predict(X_test)
            else:
                cv_scores = cross_val_score(pipeline, X_train, y_train, cv=5, scoring=scoring, n_jobs=1)
                mean_score = float(np.mean(cv_scores))
                std_score = float(np.std(cv_scores))
                pipeline.fit(X_train, y_train)
                preds = pipeline.predict(X_test)

            if baseline_score is None:
                baseline_score = mean_score

            emit({"event": "experiment_result", "id": idx, "paper_id": paper_id,
                  "technique": match['technique'], "cv_score": round(mean_score, 4),
                  "std": round(std_score, 4), "features_used": int(X_train.shape[1]),
                  "model": match['technique']})
            results.append({'id': idx, 'paper_id': paper_id, 'paper_title': match['paper_title'],
                            'technique': match['technique'], 'cv_score': mean_score,
                            'std': std_score, 'predictions': preds.tolist() if hasattr(preds, 'tolist') else list(preds),
                            'is_winner': False})
        except Exception as e:
            emit({"event": "log", "id": idx, "message": f"Primary failed: {str(e)[:120]}. Trying fallback..."})
            try:
                X_train, y_train, X_test, test_ids, id_col = basic_preprocess(train_df, test_df, target_col, frequency_encode=False)
                if problem_type == 'classification':
                    fallback = Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', GradientBoostingClassifier(n_estimators=200, max_depth=4, random_state=42))])
                else:
                    fallback = Pipeline([('imputer', SimpleImputer(strategy='median')), ('model', GradientBoostingRegressor(n_estimators=200, max_depth=4, random_state=42))])
                cv_scores = cross_val_score(fallback, X_train, y_train, cv=5, scoring=scoring, n_jobs=1)
                mean_score = float(np.mean(cv_scores))
                std_score = float(np.std(cv_scores))
                fallback.fit(X_train, y_train)
                preds = fallback.predict(X_test)
                if baseline_score is None:
                    baseline_score = mean_score
                emit({"event": "experiment_result", "id": idx, "paper_id": paper_id,
                      "technique": match['technique'] + " (fallback)", "cv_score": round(mean_score, 4),
                      "std": round(std_score, 4), "features_used": int(X_train.shape[1]),
                      "model": match['technique'] + " (fallback)"})
                results.append({'id': idx, 'paper_id': paper_id, 'paper_title': match['paper_title'],
                                'technique': match['technique'] + " (fallback)", 'cv_score': mean_score,
                                'std': std_score, 'predictions': preds.tolist() if hasattr(preds, 'tolist') else list(preds),
                                'is_winner': False})
            except Exception as e2:
                emit({"event": "experiment_error", "id": idx, "paper_id": paper_id,
                      "message": f"Both failed: {str(e2)[:120]}"})
            continue

    if not results:
        emit({"event": "error", "message": "No experiments completed successfully"})
        return None

    sorted_results = sorted(results, key=lambda r: r['cv_score'], reverse=True)
    winner = sorted_results[0]
    winner['is_winner'] = True

    emit({"event": "best_selected", "id": winner['id'], "paper_id": winner['paper_id'],
          "name": winner['technique'], "cv_score": round(winner['cv_score'], 4)})

    # Generate submission CSV
    preds = winner['predictions']
    if problem_type == 'classification':
        preds = [int(p) for p in preds]
    _, _, _, test_ids, id_col = basic_preprocess(train_df, test_df, target_col)
    if test_ids is not None and id_col is not None:
        submission = pd.DataFrame({id_col: test_ids, target_col: preds})
    else:
        submission = pd.DataFrame({'Id': range(len(preds)), target_col: preds})
    submission_csv = submission.to_csv(index=False)

    emit({"event": "submission_ready", "rows": len(preds), "winner": winner['paper_id'],
          "winner_technique": winner['technique'], "cv_score": round(winner['cv_score'], 4)})

    # Build knowledge graph
    if baseline_score is None:
        baseline_score = 0.0
    kg = build_knowledge_graph(competition, matched_papers, results, baseline_score, winner['cv_score'])
    emit({"event": "knowledge_graph_built", "nodes": len(kg['nodes']), "edges": len(kg['edges']),
          "proven": kg['proven'], "unproven": kg['unproven']})

    return {'submission_csv': submission_csv, 'knowledge_graph': kg,
            'winner': winner['technique'], 'cv_score': winner['cv_score']}
`;

// ─── Worker logic ──────────────────────────────────────────

async function initPyodide() {
  importScripts(PYODIDE_CDN + 'pyodide.js');
  self.postMessage({ type: 'progress', stage: 'init', message: 'Loading Python runtime...' });

  pyodide = await self.loadPyodide({ indexURL: PYODIDE_CDN });
  self.postMessage({ type: 'progress', stage: 'init', message: 'Installing ML packages (one-time download)...' });

  await pyodide.loadPackage(['numpy', 'pandas', 'scikit-learn']);
  packagesLoaded = true;

  // Load the registry and analyzer modules into the Python environment
  pyodide.runPython(PAPER_REGISTRY_PY);
  pyodide.runPython(DATA_ANALYZER_PY);

  self.postMessage({ type: 'ready' });
}

async function handleAnalyze({ files, competition }) {
  // Write CSV files to Pyodide virtual filesystem
  const dataDir = '/home/pyodide/data';
  pyodide.runPython(`import os; os.makedirs('/home/pyodide/data', exist_ok=True)`);

  for (const [name, content] of Object.entries(files)) {
    pyodide.FS.writeFile(`${dataDir}/${name}`, content);
  }

  // Pass values safely via globals (avoids string interpolation / injection bugs)
  pyodide.globals.set('_data_dir', dataDir);
  pyodide.globals.set('_competition', competition || '');

  const result = pyodide.runPython(`
import json
result = analyze_dataset(_data_dir, _competition)
json.dumps(result, default=str) if result else 'null'
  `);

  const analysis = JSON.parse(result);
  self.postMessage({ type: 'analyzeResult', analysis });
}

async function handleRunExperiments({ competition, aiSuggestions }) {
  const dataDir = '/home/pyodide/data';

  // Set up the emit_event callback so Python can post events to JS
  self.pyodideEventCallback = (eventJson) => {
    try {
      const event = JSON.parse(eventJson);
      self.postMessage({ type: 'event', event });
    } catch (e) {
      self.postMessage({ type: 'event', event: { event: 'log', message: eventJson } });
    }
  };

  pyodide.globals.set('emit_event', self.pyodideEventCallback);

  // Load the experiment runner
  pyodide.runPython(EXPERIMENT_RUNNER_PY);

  // Pass values safely via globals (avoids string interpolation / injection bugs)
  pyodide.globals.set('_data_dir', dataDir);
  pyodide.globals.set('_competition', competition || '');
  pyodide.globals.set('_ai_suggestions_json',
    aiSuggestions && aiSuggestions.length > 0 ? JSON.stringify(aiSuggestions) : null
  );

  const resultJson = pyodide.runPython(`
import json
ai_data = json.loads(_ai_suggestions_json) if _ai_suggestions_json else None
result = run_experiments(_data_dir, _competition, ai_data)
json.dumps(result, default=str) if result else 'null'
  `);

  const result = resultJson !== 'null' ? JSON.parse(resultJson) : null;
  self.postMessage({ type: 'experimentsResult', result });
}

// ─── Message handler ───────────────────────────────────────

self.onmessage = async (event) => {
  const { type, ...payload } = event.data;

  try {
    switch (type) {
      case 'init':
        await initPyodide();
        break;
      case 'analyze':
        await handleAnalyze(payload);
        break;
      case 'runExperiments':
        await handleRunExperiments(payload);
        break;
      default:
        self.postMessage({ type: 'error', message: `Unknown message type: ${type}` });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err), stack: err.stack });
  }
};
