#!/usr/bin/env python3
"""
Data Analyzer
Analyzes competition dataset and generates rich insights for the experiment pipeline.
"""

import sys
import os
import pandas as pd
import numpy as np
import json


def classify_feature(series):
    """Classify a feature as continuous, discrete, categorical, or high-cardinality."""
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
    """Analyze a CSV file and return insights."""
    print(f"\n📊 Analyzing: {os.path.basename(file_path)}")

    try:
        df = pd.read_csv(file_path)

        print(f"  Shape: {df.shape[0]:,} rows x {df.shape[1]} columns")
        print(f"  Memory: {df.memory_usage(deep=True).sum() / 1024 / 1024:.2f} MB")

        columns_info = {}
        print(f"\n  Columns:")
        for col in df.columns:
            dtype = df[col].dtype
            missing = int(df[col].isna().sum())
            missing_pct = (missing / len(df)) * 100
            unique = int(df[col].nunique())
            feature_type = classify_feature(df[col])

            info = {
                'dtype': str(dtype),
                'missing': missing,
                'missing_pct': round(missing_pct, 1),
                'unique': unique,
                'feature_type': feature_type
            }

            print(f"    - {col}")
            print(f"      Type: {dtype} ({feature_type})")
            print(f"      Missing: {missing:,} ({missing_pct:.1f}%)")
            print(f"      Unique: {unique:,}")

            if dtype in ['int64', 'float64'] and unique > 2:
                info['min'] = float(df[col].min()) if not pd.isna(df[col].min()) else None
                info['max'] = float(df[col].max()) if not pd.isna(df[col].max()) else None
                info['mean'] = float(df[col].mean()) if not pd.isna(df[col].mean()) else None
                info['median'] = float(df[col].median()) if not pd.isna(df[col].median()) else None
                info['std'] = float(df[col].std()) if not pd.isna(df[col].std()) else None
                print(f"      Range: [{info['min']}, {info['max']}]")
                print(f"      Mean: {info['mean']:.2f}")

            if dtype == 'object' and unique <= 20:
                info['value_counts'] = df[col].value_counts().head(10).to_dict()

            columns_info[col] = info

        # Correlation matrix for numerics
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        correlation = {}
        if len(numeric_cols) >= 2:
            corr_matrix = df[numeric_cols].corr()
            # Store top correlations (abs > 0.3, excluding self)
            for i, c1 in enumerate(numeric_cols):
                for c2 in numeric_cols[i+1:]:
                    val = corr_matrix.loc[c1, c2]
                    if not pd.isna(val) and abs(val) > 0.3:
                        correlation[f"{c1}_vs_{c2}"] = round(float(val), 3)

        # Missing value patterns
        missing_pattern = {}
        for col in df.columns:
            m = int(df[col].isna().sum())
            if m > 0:
                missing_pattern[col] = {
                    'count': m,
                    'pct': round((m / len(df)) * 100, 1)
                }

        return {
            'file': os.path.basename(file_path),
            'rows': int(df.shape[0]),
            'columns': int(df.shape[1]),
            'column_names': list(df.columns),
            'columns_info': columns_info,
            'dtypes': {col: str(dtype) for col, dtype in df.dtypes.items()},
            'missing': {col: int(df[col].isna().sum()) for col in df.columns},
            'missing_pattern': missing_pattern,
            'correlation': correlation,
            'sample': df.head(3).to_dict('records')
        }

    except Exception as e:
        print(f"  ❌ Error analyzing file: {e}")
        return None


def detect_target(train_info, test_info):
    """Auto-detect the target column (in train but not in test)."""
    id_names = {'id', 'Id', 'ID', 'PassengerId'}
    train_cols = set(train_info['column_names'])
    test_cols = set(test_info['column_names'])
    candidates = train_cols - test_cols - id_names
    if len(candidates) == 1:
        return list(candidates)[0]
    # If multiple, pick the first non-ID column unique to train
    for col in train_info['column_names']:
        if col in candidates:
            return col
    return None


def generate_recommendations(train_info, target_col):
    """Generate analysis recommendations for the experiment pipeline."""
    recs = []
    cols = train_info.get('columns_info', {})

    for col, info in cols.items():
        if col == target_col:
            continue
        if info.get('missing_pct', 0) > 30:
            recs.append(f"High missing rate in {col} ({info['missing_pct']}%) — consider indicator feature or drop")
        if info.get('feature_type') == 'high_cardinality':
            recs.append(f"High-cardinality column {col} ({info['unique']} unique) — consider frequency encoding or dropping")

    # Class balance for classification targets
    if target_col and target_col in cols:
        target_info = cols[target_col]
        if target_info.get('value_counts'):
            counts = list(target_info['value_counts'].values())
            if len(counts) >= 2:
                ratio = max(counts) / max(min(counts), 1)
                if ratio > 3:
                    recs.append(f"Class imbalance detected in {target_col} (ratio {ratio:.1f}:1) — consider class weights or resampling")

    # Correlation-based
    corr = train_info.get('correlation', {})
    for pair, val in corr.items():
        if abs(val) > 0.8:
            recs.append(f"High correlation ({val}) between {pair.replace('_vs_', ' and ')} — potential multicollinearity")

    return recs


def analyze_dataset(data_dir, competition_name):
    """Analyze all CSV files in the dataset."""
    print("=" * 60)
    print("DATA ANALYZER")
    print("=" * 60)
    print(f"Competition: {competition_name}")
    print(f"Data directory: {data_dir}")

    csv_files = [f for f in os.listdir(data_dir) if f.endswith('.csv')]

    if not csv_files:
        print("❌ No CSV files found in data directory")
        return False

    print(f"\n📁 Found {len(csv_files)} CSV file(s):")
    for f in csv_files:
        print(f"  - {f}")

    analysis_results = {}

    for csv_file in csv_files:
        file_path = os.path.join(data_dir, csv_file)
        result = analyze_csv(file_path)
        if result:
            analysis_results[csv_file] = result

    # Identify train/test files
    train_file = None
    test_file = None
    for f in csv_files:
        if 'train' in f.lower():
            train_file = f
        elif 'test' in f.lower():
            test_file = f

    # Detect target and generate recommendations
    target_col = None
    recommendations = []
    class_balance = None

    if train_file and test_file and train_file in analysis_results and test_file in analysis_results:
        target_col = detect_target(analysis_results[train_file], analysis_results[test_file])
        if target_col:
            print(f"\n🎯 Detected target column: {target_col}")
            recommendations = generate_recommendations(analysis_results[train_file], target_col)

            # Class balance info
            target_info = analysis_results[train_file]['columns_info'].get(target_col, {})
            if target_info.get('value_counts'):
                class_balance = target_info['value_counts']
                print(f"  Class distribution: {class_balance}")

            # Detect problem type
            unique = target_info.get('unique', 0)
            dtype = target_info.get('dtype', '')
            if unique <= 20 and (dtype in ['int64', 'object', 'bool', 'str', 'string', 'category'] or 'str' in dtype):
                problem_type = 'classification'
            else:
                problem_type = 'regression'
            print(f"  Problem type: {problem_type}")

    if train_file and test_file:
        print(f"\n🎯 Detected:")
        print(f"  Training data: {train_file}")
        print(f"  Test data: {test_file}")

    if recommendations:
        print(f"\n💡 Recommendations:")
        for r in recommendations:
            print(f"  - {r}")

    # Compute extra fields for paper matching
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
        numeric_count = sum(
            1 for v in feature_cols.values()
            if v.get('feature_type') in ('continuous', 'discrete')
        )
        cat_count = sum(
            1 for v in feature_cols.values()
            if v.get('feature_type') in ('categorical', 'high_cardinality')
        )
        numeric_ratio = numeric_count / max(num_features, 1)
        has_categoricals = cat_count > 0
        missing_columns = [
            k for k, v in feature_cols.items()
            if v.get('missing_pct', 0) > 5
        ]
        has_missing = len(missing_columns) > 0

    # Add metadata to analysis
    analysis_results['_meta'] = {
        'competition': competition_name,
        'train_file': train_file,
        'test_file': test_file,
        'target_column': target_col,
        'class_balance': class_balance,
        'recommendations': recommendations,
        'numeric_ratio': round(numeric_ratio, 3),
        'has_categoricals': has_categoricals,
        'has_missing': has_missing,
        'missing_columns': missing_columns,
        'num_features': num_features,
    }

    # Save analysis to JSON
    analysis_path = os.path.join(data_dir, 'analysis.json')
    with open(analysis_path, 'w') as f:
        json.dump(analysis_results, f, indent=2, default=str)

    print(f"\n💾 Analysis saved to: {analysis_path}")
    print("\n✓ Analysis completed successfully!")
    return True


def main():
    if len(sys.argv) < 3:
        print("Usage: python data_analyzer.py <data_dir> <competition_name>")
        sys.exit(1)

    data_dir = sys.argv[1]
    competition_name = sys.argv[2]

    success = analyze_dataset(data_dir, competition_name)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
