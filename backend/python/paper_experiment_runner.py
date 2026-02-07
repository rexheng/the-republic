#!/usr/bin/env python3
"""
Paper Experiment Runner — Paper-Driven AI Agent Pipeline

Replaces the 3-agent experiment_runner.py with a paper-driven approach:
  1. Load analysis.json, build dataset context
  2. Search paper registry for relevant techniques
  3. Run each matched paper's sklearn pipeline with 5-fold CV
  4. Special handling for pseudo-labeling and NAS search
  5. Select winner, generate submission.csv
  6. Build knowledge_graph.json

Output: structured JSON lines to stdout
"""

import sys
import os
import json
import warnings
import numpy as np
import pandas as pd
from sklearn.model_selection import cross_val_score, RandomizedSearchCV
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import GradientBoostingClassifier, GradientBoostingRegressor
from sklearn.impute import SimpleImputer

from paper_registry import (
    build_dataset_context,
    find_relevant_papers,
    get_paper_entry,
    build_experiment_pipeline,
)

warnings.filterwarnings('ignore')


def emit(event_dict):
    """Emit a structured JSON event to stdout."""
    print(json.dumps(event_dict), flush=True)


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
    """Shared preprocessing: drop IDs, handle missing, encode categoricals."""
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

    # Encode categoricals
    for col in X_train.columns:
        if X_train[col].dtype == 'object' or X_train[col].dtype.name == 'string' or not pd.api.types.is_numeric_dtype(X_train[col]):
            if frequency_encode:
                # Frequency encoding (mikolov2013 style)
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
    """Special handler for kipf2017 pseudo-labeling."""
    # First pass: normal training
    pipeline.fit(X_train, y_train)
    test_proba = pipeline.predict_proba(X_test) if hasattr(pipeline, 'predict_proba') else None

    if test_proba is not None:
        # Pick confident predictions (>0.9 probability)
        max_proba = test_proba.max(axis=1)
        confident_mask = max_proba > 0.9
        n_confident = confident_mask.sum()

        if n_confident > 10:
            pseudo_labels = pipeline.predict(X_test)
            X_pseudo = X_test[confident_mask]
            y_pseudo = pseudo_labels[confident_mask]

            # Combine and retrain
            X_combined = pd.concat([X_train, X_pseudo], ignore_index=True)
            y_combined = pd.concat([y_train, pd.Series(y_pseudo)], ignore_index=True)

            cv_scores = cross_val_score(pipeline, X_combined, y_combined, cv=5, scoring=scoring, n_jobs=-1)
            pipeline.fit(X_combined, y_combined)
            preds = pipeline.predict(X_test)
            return cv_scores, preds, f"Pseudo-labeled {n_confident} samples"

    # Fallback: just do normal CV
    cv_scores = cross_val_score(pipeline, X_train, y_train, cv=5, scoring=scoring, n_jobs=-1)
    pipeline.fit(X_train, y_train)
    preds = pipeline.predict(X_test)
    return cv_scores, preds, "Standard training (pseudo-labeling not confident enough)"


def run_nas_experiment(pipeline, X_train, y_train, X_test, context, scoring):
    """Special handler for zoph2017 NAS-style hyperparameter search."""
    if context['problem_type'] == 'classification':
        param_dist = {
            'model__n_estimators': [100, 200, 300, 500],
            'model__max_depth': [3, 4, 5, 6, 7],
            'model__learning_rate': [0.01, 0.05, 0.1, 0.15],
            'model__subsample': [0.6, 0.7, 0.8, 0.9, 1.0],
            'model__min_samples_split': [2, 5, 10],
            'model__min_samples_leaf': [1, 2, 4],
        }
    else:
        param_dist = {
            'model__n_estimators': [100, 200, 300, 500],
            'model__max_depth': [3, 4, 5, 6, 7],
            'model__learning_rate': [0.01, 0.05, 0.1, 0.15],
            'model__subsample': [0.6, 0.7, 0.8, 0.9, 1.0],
            'model__min_samples_split': [2, 5, 10],
            'model__min_samples_leaf': [1, 2, 4],
        }

    search = RandomizedSearchCV(
        pipeline, param_dist, n_iter=20, cv=5,
        scoring=scoring, random_state=42, n_jobs=-1
    )
    search.fit(X_train, y_train)

    cv_scores = np.array([search.best_score_])
    std = float(search.cv_results_['std_test_score'][search.best_index_])
    preds = search.predict(X_test)
    params_str = json.dumps({k.replace('model__', ''): v for k, v in search.best_params_.items()})
    return cv_scores, std, preds, f"Best params: {params_str}"


def build_knowledge_graph(competition, matched_papers, results, baseline_score, best_score):
    """Build knowledge graph JSON."""
    nodes = []
    edges = []

    for match in matched_papers:
        paper_node_id = f"paper:{match['paper_id']}"
        tech_node_id = f"tech:{match['paper_id']}"

        nodes.append({
            'id': paper_node_id,
            'type': 'paper',
            'label': f"{match['paper_title'][:40]}...",
            'paper_id': match['paper_id'],
        })
        nodes.append({
            'id': tech_node_id,
            'type': 'technique',
            'label': match['technique'],
        })
        edges.append({
            'source': paper_node_id,
            'target': tech_node_id,
            'type': 'inspires',
        })

    for r in results:
        result_node_id = f"result:{r['id']}"
        tech_node_id = f"tech:{r['paper_id']}"
        is_winner = r.get('is_winner', False)
        status = 'proven' if r['cv_score'] > baseline_score else 'unproven'
        if is_winner:
            status = 'winner'

        nodes.append({
            'id': result_node_id,
            'type': 'result',
            'cv_score': r['cv_score'],
            'status': status,
            'is_winner': is_winner,
            'label': f"CV={r['cv_score']:.4f}",
        })
        edges.append({
            'source': tech_node_id,
            'target': result_node_id,
            'type': 'produces',
        })

    proven_count = sum(1 for n in nodes if n.get('status') == 'proven' or n.get('status') == 'winner')
    unproven_count = sum(1 for n in nodes if n.get('status') == 'unproven')

    return {
        'competition': competition,
        'nodes': nodes,
        'edges': edges,
        'baseline_score': round(baseline_score, 4),
        'best_score': round(best_score, 4),
        'proven': proven_count,
        'unproven': unproven_count,
    }


def main():
    if len(sys.argv) < 4:
        emit({"event": "error", "message": "Usage: paper_experiment_runner.py <data_dir> <submissions_dir> <competition>"})
        sys.exit(1)

    data_dir = sys.argv[1]
    submissions_dir = sys.argv[2]
    competition = sys.argv[3]

    os.makedirs(submissions_dir, exist_ok=True)

    # Load analysis.json
    analysis_path = os.path.join(data_dir, 'analysis.json')
    if not os.path.exists(analysis_path):
        emit({"event": "error", "message": "analysis.json not found — run data_analyzer first"})
        sys.exit(1)

    with open(analysis_path, 'r') as f:
        analysis = json.load(f)

    # Build dataset context
    context = build_dataset_context(analysis)

    # Load data
    csv_files = [f for f in os.listdir(data_dir) if f.endswith('.csv')]
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

    problem_type = context['problem_type']
    scoring = 'accuracy' if problem_type == 'classification' else 'neg_root_mean_squared_error'

    emit({"event": "pipeline_start", "competition": competition,
          "train_rows": len(train_df), "test_rows": len(test_df),
          "target": target_col, "problem_type": problem_type})

    # ─── Paper Search ───────────────────────────
    emit({"event": "paper_search_start", "message": "Searching 50 papers for relevant techniques..."})

    matched_papers = find_relevant_papers(context, max_papers=8)

    for match in matched_papers:
        emit({
            "event": "paper_matched",
            "paper_id": match['paper_id'],
            "paper_title": match['paper_title'],
            "technique": match['technique'],
            "reason": match['reason'],
        })

    emit({"event": "paper_search_done", "matched": len(matched_papers), "total": 15})

    # ─── Run Experiments ────────────────────────
    results = []
    baseline_score = None

    for idx, match in enumerate(matched_papers, 1):
        paper_id = match['paper_id']
        paper_entry = get_paper_entry(paper_id)

        if paper_entry is None:
            continue

        # Use frequency encoding for mikolov2013
        use_freq = paper_id == 'mikolov2013'
        X_train, y_train, X_test, test_ids, id_col = basic_preprocess(
            train_df, test_df, target_col, frequency_encode=use_freq
        )

        experiment_info = build_experiment_pipeline(paper_entry, context)
        pipeline = experiment_info['pipeline']

        emit({
            "event": "experiment_start",
            "id": idx,
            "paper_id": paper_id,
            "paper_title": match['paper_title'],
            "technique": match['technique'],
            "strategy": experiment_info['description'],
        })

        try:
            extra_info = ""

            if paper_id == 'kipf2017':
                # Pseudo-labeling special handler
                cv_scores, preds, extra_info = run_pseudo_label_experiment(
                    pipeline, X_train, y_train, X_test, problem_type, scoring
                )
                mean_score = float(np.mean(cv_scores))
                std_score = float(np.std(cv_scores))

            elif paper_id == 'zoph2017':
                # NAS search special handler
                cv_scores, std_score, preds, extra_info = run_nas_experiment(
                    pipeline, X_train, y_train, X_test, context, scoring
                )
                mean_score = float(np.mean(cv_scores))

            elif paper_id == 'kaplan2020':
                # Ensemble doesn't use Pipeline, needs special handling
                ensemble = pipeline  # This is a VotingClassifier/Regressor
                cv_scores = cross_val_score(ensemble, X_train, y_train, cv=5, scoring=scoring, n_jobs=-1)
                mean_score = float(np.mean(cv_scores))
                std_score = float(np.std(cv_scores))
                ensemble.fit(X_train, y_train)
                preds = ensemble.predict(X_test)

            else:
                # Standard pipeline
                cv_scores = cross_val_score(pipeline, X_train, y_train, cv=5, scoring=scoring, n_jobs=-1)
                mean_score = float(np.mean(cv_scores))
                std_score = float(np.std(cv_scores))
                pipeline.fit(X_train, y_train)
                preds = pipeline.predict(X_test)

            if extra_info:
                emit({"event": "log", "id": idx, "message": extra_info})

            # Track baseline (first experiment)
            if baseline_score is None:
                baseline_score = mean_score

            emit({
                "event": "experiment_result",
                "id": idx,
                "paper_id": paper_id,
                "technique": match['technique'],
                "cv_score": round(mean_score, 4),
                "std": round(std_score, 4),
                "features_used": X_train.shape[1],
                "model": match['technique'],
            })

            results.append({
                'id': idx,
                'paper_id': paper_id,
                'paper_title': match['paper_title'],
                'technique': match['technique'],
                'cv_score': mean_score,
                'std': std_score,
                'predictions': preds,
                'is_winner': False,
            })

        except Exception as e:
            emit({"event": "experiment_error", "id": idx, "paper_id": paper_id,
                  "message": str(e)})
            continue

    if not results:
        emit({"event": "error", "message": "No experiments completed successfully"})
        sys.exit(1)

    # ─── Select Winner ──────────────────────────
    sorted_results = sorted(results, key=lambda r: r['cv_score'], reverse=True)
    winner = sorted_results[0]
    winner['is_winner'] = True

    emit({
        "event": "best_selected",
        "id": winner['id'],
        "paper_id": winner['paper_id'],
        "name": winner['technique'],
        "cv_score": round(winner['cv_score'], 4),
    })

    # ─── Generate Submission ────────────────────
    preds = winner['predictions']
    if problem_type == 'classification':
        preds = np.array(preds).astype(int)

    # Get test_ids from a clean preprocess call
    _, _, _, test_ids, id_col = basic_preprocess(train_df, test_df, target_col)

    if test_ids is not None and id_col is not None:
        submission = pd.DataFrame({id_col: test_ids, target_col: preds})
    else:
        submission = pd.DataFrame({'Id': range(len(preds)), target_col: preds})

    output_path = os.path.join(submissions_dir, 'submission.csv')
    submission.to_csv(output_path, index=False)

    emit({
        "event": "submission_ready",
        "path": output_path,
        "rows": len(preds),
        "winner": winner['paper_id'],
        "winner_technique": winner['technique'],
        "cv_score": round(winner['cv_score'], 4),
    })

    # ─── Build Knowledge Graph ──────────────────
    if baseline_score is None:
        baseline_score = 0.0

    kg = build_knowledge_graph(
        competition, matched_papers, results,
        baseline_score, winner['cv_score']
    )

    kg_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', competition)
    os.makedirs(kg_dir, exist_ok=True)
    kg_path = os.path.join(kg_dir, 'knowledge_graph.json')
    with open(kg_path, 'w') as f:
        json.dump(kg, f, indent=2)

    emit({
        "event": "knowledge_graph_built",
        "nodes": len(kg['nodes']),
        "edges": len(kg['edges']),
        "proven": kg['proven'],
        "unproven": kg['unproven'],
        "path": kg_path,
    })

    sys.exit(0)


if __name__ == "__main__":
    main()
