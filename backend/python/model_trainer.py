#!/usr/bin/env python3
"""
Model Trainer
Trains a baseline machine learning model and generates predictions
"""

import sys
import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import cross_val_score
import json

def detect_problem_type(df, target_col):
    """Detect if problem is classification or regression"""
    unique_values = df[target_col].nunique()

    if unique_values <= 20 and df[target_col].dtype in ['int64', 'object']:
        return 'classification'
    else:
        return 'regression'

def prepare_features(train_df, test_df, target_col):
    """Prepare features for training"""
    print("\n🔧 Preparing features...")

    # Separate features and target
    X_train = train_df.drop(columns=[target_col])
    y_train = train_df[target_col]
    X_test = test_df.copy()

    # Store ID column if present
    id_col = None
    for col in ['id', 'Id', 'ID', 'PassengerId']:
        if col in X_test.columns:
            id_col = col
            test_ids = X_test[col]
            X_train = X_train.drop(columns=[col], errors='ignore')
            X_test = X_test.drop(columns=[col])
            print(f"  • Found ID column: {col}")
            break

    # Get common columns
    common_cols = list(set(X_train.columns) & set(X_test.columns))
    X_train = X_train[common_cols]
    X_test = X_test[common_cols]

    print(f"  • Training features: {X_train.shape[1]}")
    print(f"  • Test samples: {X_test.shape[0]}")

    # Handle missing values and encode categorical variables
    label_encoders = {}

    # Drop high-cardinality columns that are likely IDs or names
    drop_cols = []
    for col in X_train.columns:
        if X_train[col].dtype == 'object' or X_train[col].dtype == 'string':
            if X_train[col].nunique() > 50:  # High cardinality
                drop_cols.append(col)
                print(f"  • Dropped high-cardinality column: {col}")

    X_train = X_train.drop(columns=drop_cols)
    X_test = X_test.drop(columns=drop_cols)

    for col in X_train.columns:
        # Fill missing values
        if X_train[col].dtype == 'object' or X_train[col].dtype == 'string':
            X_train[col] = X_train[col].fillna('missing')
            X_test[col] = X_test[col].fillna('missing')

            # Label encode categorical columns with unseen label handling
            le = LabelEncoder()
            X_train[col] = le.fit_transform(X_train[col].astype(str))

            # Handle unseen labels in test set
            test_col_str = X_test[col].astype(str)
            X_test[col] = test_col_str.apply(
                lambda x: le.transform([x])[0] if x in le.classes_ else -1
            )
            label_encoders[col] = le
            print(f"  • Encoded categorical: {col}")
        else:
            median_val = X_train[col].median()
            X_train[col] = X_train[col].fillna(median_val)
            X_test[col] = X_test[col].fillna(median_val)

    return X_train, y_train, X_test, test_ids if id_col else None, id_col

def train_model(X_train, y_train, problem_type):
    """Train a baseline model"""
    print(f"\n🤖 Training {problem_type} model...")

    if problem_type == 'classification':
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
    else:
        model = RandomForestRegressor(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )

    # Train model
    model.fit(X_train, y_train)
    print("  ✓ Model trained")

    # Cross-validation
    print("\n📊 Evaluating model...")
    cv_scores = cross_val_score(model, X_train, y_train, cv=3, n_jobs=-1)
    print(f"  • CV Score: {cv_scores.mean():.4f} (+/- {cv_scores.std():.4f})")

    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': X_train.columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)

    print("\n🎯 Top 10 Important Features:")
    for idx, row in feature_importance.head(10).iterrows():
        print(f"  {row['feature']}: {row['importance']:.4f}")

    return model

def generate_submission(model, X_test, test_ids, id_col, output_path):
    """Generate submission file"""
    print("\n📝 Generating submission...")

    # Make predictions
    predictions = model.predict(X_test)

    # Create submission dataframe
    if test_ids is not None and id_col is not None:
        submission = pd.DataFrame({
            id_col: test_ids,
            'prediction': predictions
        })
    else:
        submission = pd.DataFrame({
            'id': range(len(predictions)),
            'prediction': predictions
        })

    # Save submission
    submission.to_csv(output_path, index=False)
    print(f"  ✓ Saved to: {output_path}")
    print(f"  • Predictions: {len(predictions)}")
    print(f"  • Sample: {predictions[:5]}")

    return True

def train_and_predict(data_dir, submissions_dir, competition_name):
    """Main training pipeline"""
    print("=" * 60)
    print("MODEL TRAINER")
    print("=" * 60)
    print(f"Competition: {competition_name}")

    # Find train and test files
    csv_files = [f for f in os.listdir(data_dir) if f.endswith('.csv')]
    train_file = next((f for f in csv_files if 'train' in f.lower()), None)
    test_file = next((f for f in csv_files if 'test' in f.lower()), None)

    if not train_file or not test_file:
        print("❌ Could not find train.csv and test.csv")
        return False

    print(f"📁 Training file: {train_file}")
    print(f"📁 Test file: {test_file}")

    # Load data
    train_df = pd.read_csv(os.path.join(data_dir, train_file))
    test_df = pd.read_csv(os.path.join(data_dir, test_file))

    print(f"  • Training samples: {len(train_df)}")
    print(f"  • Test samples: {len(test_df)}")

    # Detect target column (usually the last column not in test)
    target_col = None
    for col in train_df.columns:
        if col not in test_df.columns and col.lower() not in ['id', 'passangerid']:
            target_col = col
            break

    if not target_col:
        print("❌ Could not detect target column")
        return False

    print(f"\n🎯 Target column: {target_col}")

    # Detect problem type
    problem_type = detect_problem_type(train_df, target_col)
    print(f"  • Problem type: {problem_type}")

    # Prepare features
    X_train, y_train, X_test, test_ids, id_col = prepare_features(train_df, test_df, target_col)

    # Train model
    model = train_model(X_train, y_train, problem_type)

    # Generate submission
    output_path = os.path.join(submissions_dir, 'submission.csv')
    success = generate_submission(model, X_test, test_ids, id_col, output_path)

    if success:
        print("\n✓ Training and prediction completed successfully!")
        return True
    else:
        return False

def main():
    if len(sys.argv) < 4:
        print("Usage: python model_trainer.py <data_dir> <submissions_dir> <competition_name>")
        sys.exit(1)

    data_dir = sys.argv[1]
    submissions_dir = sys.argv[2]
    competition_name = sys.argv[3]

    success = train_and_predict(data_dir, submissions_dir, competition_name)
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
