#!/usr/bin/env python3
"""
Experiment Runner — AI Agent Orchestrator
Runs multiple experiment strategies (agents) and selects the best one.

Agents:
  1. Scout (Baseline)        — LogisticRegression/Ridge, minimal preprocessing
  2. Feature Engineer + GBM  — Engineered features + GradientBoosting
  3. Tuner                   — RandomizedSearchCV on best model from 1-2

Output: structured JSON lines to stdout
"""

import sys
import os
import json
import warnings
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression, Ridge
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.model_selection import cross_val_score, RandomizedSearchCV
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline

warnings.filterwarnings('ignore')


def emit(event_dict):
    """Emit a structured JSON event to stdout."""
    print(json.dumps(event_dict), flush=True)


def detect_problem_type(y):
    """Detect classification vs regression."""
    unique = y.nunique()
    if unique <= 20 and y.dtype in ['int64', 'object', 'bool']:
        return 'classification'
    return 'regression'


def find_target_column(train_df, test_df):
    """Auto-detect the target column (in train but not test, excluding IDs)."""
    id_names = {'id', 'Id', 'ID', 'PassengerId', 'passangerid'}
    for col in train_df.columns:
        if col not in test_df.columns and col not in id_names:
            return col
    return None


def find_id_column(df):
    """Find the ID column in the dataframe."""
    for col in ['PassengerId', 'Id', 'id', 'ID']:
        if col in df.columns:
            return col
    return None


def basic_preprocess(train_df, test_df, target_col):
    """Minimal preprocessing: drop IDs, handle missing, encode categoricals."""
    X_train = train_df.drop(columns=[target_col])
    y_train = train_df[target_col]
    X_test = test_df.copy()

    id_col = find_id_column(X_test)
    test_ids = X_test[id_col].copy() if id_col else None
    if id_col:
        X_train = X_train.drop(columns=[id_col], errors='ignore')
        X_test = X_test.drop(columns=[id_col])

    common_cols = sorted(set(X_train.columns) & set(X_test.columns))
    X_train = X_train[common_cols].copy()
    X_test = X_test[common_cols].copy()

    # Drop high-cardinality string columns
    drop_cols = []
    for col in X_train.columns:
        if X_train[col].dtype == 'object' and X_train[col].nunique() > 50:
            drop_cols.append(col)
    X_train = X_train.drop(columns=drop_cols)
    X_test = X_test.drop(columns=drop_cols)

    # Encode categoricals and impute
    for col in X_train.columns:
        if X_train[col].dtype == 'object':
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


def engineer_features(X_train, X_test):
    """Create interaction features, bins, and missing-value indicators."""
    for df in [X_train, X_test]:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

        # Interaction features: products of top numeric pairs
        if len(numeric_cols) >= 2:
            pairs = min(3, len(numeric_cols) * (len(numeric_cols) - 1) // 2)
            count = 0
            for i in range(len(numeric_cols)):
                for j in range(i + 1, len(numeric_cols)):
                    if count >= pairs:
                        break
                    c1, c2 = numeric_cols[i], numeric_cols[j]
                    df[f'{c1}_x_{c2}'] = df[c1] * df[c2]
                    count += 1

        # Bin continuous features into quartiles
        for col in numeric_cols:
            if df[col].nunique() > 10:
                df[f'{col}_bin'] = pd.qcut(df[col], q=4, labels=False, duplicates='drop')

    return X_train, X_test


# ──────────────────────────────────────────────
# Agent 1: Scout (Baseline)
# ──────────────────────────────────────────────
def run_scout(X_train, y_train, X_test, problem_type):
    """Minimal preprocessing + LogisticRegression/Ridge."""
    emit({"event": "experiment_start", "id": 1, "name": "Scout (Baseline)",
          "strategy": "Minimal preprocessing + LogisticRegression/Ridge"})

    scaler = StandardScaler()
    X_tr_scaled = scaler.fit_transform(X_train)
    X_te_scaled = scaler.transform(X_test)

    emit({"event": "log", "id": 1,
          "message": f"Training on {X_tr_scaled.shape[0]} samples, {X_tr_scaled.shape[1]} features..."})

    if problem_type == 'classification':
        model = LogisticRegression(max_iter=1000, random_state=42, solver='lbfgs')
        scoring = 'accuracy'
    else:
        model = Ridge(alpha=1.0, random_state=42)
        scoring = 'neg_root_mean_squared_error'

    cv_scores = cross_val_score(model, X_tr_scaled, y_train, cv=5, scoring=scoring, n_jobs=-1)
    mean_score = float(np.mean(cv_scores))
    std_score = float(np.std(cv_scores))

    model.fit(X_tr_scaled, y_train)
    preds = model.predict(X_te_scaled)

    model_name = 'LogisticRegression' if problem_type == 'classification' else 'Ridge'
    emit({"event": "experiment_result", "id": 1,
          "cv_score": round(mean_score, 4), "std": round(std_score, 4),
          "features_used": X_tr_scaled.shape[1], "model": model_name})

    return {
        "id": 1, "name": "Scout (Baseline)", "model_type": model_name,
        "cv_score": mean_score, "std": std_score,
        "model": model, "scaler": scaler,
        "predictions": preds, "problem_type": problem_type,
        "needs_engineering": False
    }


# ──────────────────────────────────────────────
# Agent 2: Feature Engineer + GBM
# ──────────────────────────────────────────────
def run_feature_gbm(X_train, y_train, X_test, problem_type):
    """Engineered features + GradientBoosting."""
    emit({"event": "experiment_start", "id": 2, "name": "Feature Engineer + GBM",
          "strategy": "Engineered features + GradientBoosting"})

    X_tr_eng = X_train.copy()
    X_te_eng = X_test.copy()
    X_tr_eng, X_te_eng = engineer_features(X_tr_eng, X_te_eng)

    # Fill any NaN introduced by feature engineering
    X_tr_eng = X_tr_eng.fillna(0)
    X_te_eng = X_te_eng.fillna(0)

    emit({"event": "log", "id": 2,
          "message": f"Engineered {X_tr_eng.shape[1]} features (from {X_train.shape[1]} original)"})
    emit({"event": "log", "id": 2,
          "message": f"Training GBM on {X_tr_eng.shape[0]} samples..."})

    if problem_type == 'classification':
        model = GradientBoostingClassifier(
            n_estimators=200, max_depth=4, learning_rate=0.1,
            subsample=0.8, random_state=42
        )
        scoring = 'accuracy'
    else:
        model = GradientBoostingRegressor(
            n_estimators=200, max_depth=4, learning_rate=0.1,
            subsample=0.8, random_state=42
        )
        scoring = 'neg_root_mean_squared_error'

    cv_scores = cross_val_score(model, X_tr_eng, y_train, cv=5, scoring=scoring, n_jobs=-1)
    mean_score = float(np.mean(cv_scores))
    std_score = float(np.std(cv_scores))

    model.fit(X_tr_eng, y_train)
    preds = model.predict(X_te_eng)

    model_name = 'GradientBoostingClassifier' if problem_type == 'classification' else 'GradientBoostingRegressor'
    emit({"event": "experiment_result", "id": 2,
          "cv_score": round(mean_score, 4), "std": round(std_score, 4),
          "features_used": X_tr_eng.shape[1], "model": model_name})

    return {
        "id": 2, "name": "Feature Engineer + GBM", "model_type": model_name,
        "cv_score": mean_score, "std": std_score,
        "model": model, "scaler": None,
        "predictions": preds, "problem_type": problem_type,
        "needs_engineering": True,
        "X_train_eng": X_tr_eng, "X_test_eng": X_te_eng
    }


# ──────────────────────────────────────────────
# Agent 3: Tuner
# ──────────────────────────────────────────────
def run_tuner(X_train, y_train, X_test, problem_type, prev_results):
    """RandomizedSearchCV on the best model type from prior agents."""
    emit({"event": "experiment_start", "id": 3, "name": "Tuner",
          "strategy": "RandomizedSearchCV on best model from prior agents"})

    # Pick the best prior result
    best_prior = max(prev_results, key=lambda r: r['cv_score'])
    emit({"event": "log", "id": 3,
          "message": f"Best prior agent: {best_prior['name']} (CV={best_prior['cv_score']:.4f})"})

    # Use engineered features if the best model used them
    if best_prior.get('needs_engineering'):
        X_tr = best_prior['X_train_eng'].copy()
        X_te = best_prior['X_test_eng'].copy()
    else:
        scaler = StandardScaler()
        X_tr = pd.DataFrame(scaler.fit_transform(X_train), columns=X_train.columns)
        X_te = pd.DataFrame(scaler.transform(X_test), columns=X_test.columns)

    emit({"event": "log", "id": 3,
          "message": f"Tuning with {X_tr.shape[1]} features, {X_tr.shape[0]} samples..."})

    if problem_type == 'classification':
        base_model = GradientBoostingClassifier(random_state=42)
        param_dist = {
            'n_estimators': [100, 200, 300, 400],
            'max_depth': [3, 4, 5, 6],
            'learning_rate': [0.01, 0.05, 0.1, 0.15],
            'subsample': [0.7, 0.8, 0.9, 1.0],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4]
        }
        scoring = 'accuracy'
    else:
        base_model = GradientBoostingRegressor(random_state=42)
        param_dist = {
            'n_estimators': [100, 200, 300, 400],
            'max_depth': [3, 4, 5, 6],
            'learning_rate': [0.01, 0.05, 0.1, 0.15],
            'subsample': [0.7, 0.8, 0.9, 1.0],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4]
        }
        scoring = 'neg_root_mean_squared_error'

    search = RandomizedSearchCV(
        base_model, param_dist, n_iter=20, cv=5,
        scoring=scoring, random_state=42, n_jobs=-1
    )
    search.fit(X_tr, y_train)

    best_params = search.best_params_
    mean_score = float(search.best_score_)
    std_score = float(search.cv_results_['std_test_score'][search.best_index_])

    emit({"event": "log", "id": 3,
          "message": f"Best params: {json.dumps(best_params)}"})

    preds = search.predict(X_te)

    model_name = 'GBM-Tuned'
    emit({"event": "experiment_result", "id": 3,
          "cv_score": round(mean_score, 4), "std": round(std_score, 4),
          "features_used": X_tr.shape[1], "model": model_name})

    return {
        "id": 3, "name": "Tuner", "model_type": model_name,
        "cv_score": mean_score, "std": std_score,
        "model": search.best_estimator_,
        "predictions": preds, "problem_type": problem_type
    }


# ──────────────────────────────────────────────
# Orchestrator
# ──────────────────────────────────────────────
def select_best(results, test_ids, id_col, target_col, submissions_dir):
    """Pick the winner, generate submission."""
    sorted_results = sorted(results, key=lambda r: r['cv_score'], reverse=True)
    winner = sorted_results[0]

    emit({"event": "best_selected", "id": winner['id'],
          "name": winner['name'], "cv_score": round(winner['cv_score'], 4)})

    # Generate submission
    preds = winner['predictions']

    # For classification, ensure integer predictions if target was int
    if winner['problem_type'] == 'classification':
        preds = preds.astype(int)

    if test_ids is not None and id_col is not None:
        submission = pd.DataFrame({id_col: test_ids, target_col: preds})
    else:
        submission = pd.DataFrame({'Id': range(len(preds)), target_col: preds})

    output_path = os.path.join(submissions_dir, 'submission.csv')
    submission.to_csv(output_path, index=False)

    emit({"event": "submission_ready", "path": output_path,
          "rows": len(preds), "winner": winner['name'],
          "cv_score": round(winner['cv_score'], 4)})

    return output_path


def main():
    if len(sys.argv) < 4:
        print(json.dumps({"event": "error", "message": "Usage: experiment_runner.py <data_dir> <submissions_dir> <competition>"}))
        sys.exit(1)

    data_dir = sys.argv[1]
    submissions_dir = sys.argv[2]
    competition = sys.argv[3]

    os.makedirs(submissions_dir, exist_ok=True)

    # Load data
    csv_files = [f for f in os.listdir(data_dir) if f.endswith('.csv') and f != 'analysis.json']
    train_file = next((f for f in csv_files if 'train' in f.lower()), None)
    test_file = next((f for f in csv_files if 'test' in f.lower()), None)

    if not train_file or not test_file:
        emit({"event": "error", "message": "Could not find train.csv and test.csv"})
        sys.exit(1)

    train_df = pd.read_csv(os.path.join(data_dir, train_file))
    test_df = pd.read_csv(os.path.join(data_dir, test_file))

    target_col = find_target_column(train_df, test_df)
    if not target_col:
        emit({"event": "error", "message": "Could not detect target column"})
        sys.exit(1)

    problem_type = detect_problem_type(train_df[target_col])

    emit({"event": "pipeline_start", "competition": competition,
          "train_rows": len(train_df), "test_rows": len(test_df),
          "target": target_col, "problem_type": problem_type,
          "num_agents": 3})

    # Basic preprocessing (shared by agents that don't do their own)
    X_train, y_train, X_test, test_ids, id_col = basic_preprocess(train_df, test_df, target_col)

    # Run agents sequentially
    results = []

    # Agent 1: Scout
    r1 = run_scout(X_train, y_train, X_test, problem_type)
    results.append(r1)

    # Agent 2: Feature Engineer + GBM
    r2 = run_feature_gbm(X_train, y_train, X_test, problem_type)
    results.append(r2)

    # Agent 3: Tuner (uses results from 1-2)
    r3 = run_tuner(X_train, y_train, X_test, problem_type, results)
    results.append(r3)

    # Select winner and generate submission
    select_best(results, test_ids, id_col, target_col, submissions_dir)

    sys.exit(0)


if __name__ == "__main__":
    main()
