# 🏆 Kaggle Competition Workflow

Automated end-to-end pipeline for Kaggle competitions: **Input competition name → Download data → Analyze → Train → Submit**

## Overview

This system automates the tedious parts of Kaggle competitions, letting you focus on improving models instead of boilerplate code.

### What It Does

1. **Download** - Fetches competition data using Kaggle API
2. **Analyze** - Explores dataset structure, types, missing values
3. **Train** - Trains a baseline Random Forest model with cross-validation
4. **Submit** - Generates submission.csv ready for upload

### Architecture

- **Backend**: Node.js (Express) + Python workers
  - Express server handles API and WebSocket
  - Python scripts do data science work
  - Real-time progress via WebSocket

- **Frontend**: React component integrated into existing app
  - Agent cards show pipeline stages
  - Live log streaming
  - One-click submission download

## Quick Start

### Prerequisites

- Node.js 16+
- Python 3.7+
- Kaggle API credentials

### Installation

1. **Setup Backend**
   ```bash
   cd backend
   ./setup.sh
   ```
   This installs all Node and Python dependencies.

2. **Configure Kaggle API**

   Get your API token from [kaggle.com/settings](https://kaggle.com/settings) → API → Create New Token

   You can either:
   - Enter it in the frontend when starting a pipeline, OR
   - Configure system-wide: move `kaggle.json` to `~/.kaggle/`

3. **Start Backend**
   ```bash
   cd backend
   npm start
   ```
   Server starts on `http://localhost:3001`

4. **Start Frontend** (if not already running)
   ```bash
   cd frontend
   npm start
   ```
   Frontend runs on `http://localhost:3000`

### Usage

1. Connect your wallet in the main app
2. Navigate to **"🏆 Kaggle Lab"** tab
3. Enter competition name (e.g., "titanic")
4. (Optional) Enter your Kaggle API token
5. Click **"🚀 Start Pipeline"**
6. Watch the agents work in real-time
7. When complete, click **"📥 Download Submission"**
8. Upload `submission.csv` to Kaggle

## Example: Titanic Competition

```
Competition: titanic

Pipeline Stages:
├─ 📥 Data Downloader     [✅ Completed]
│  └─ Downloaded: train.csv, test.csv, gender_submission.csv
│
├─ 📊 Data Analyzer       [✅ Completed]
│  ├─ Training: 891 rows × 12 columns
│  ├─ Test: 418 rows × 11 columns
│  └─ Target: Survived (binary classification)
│
├─ 🤖 Model Trainer       [✅ Completed]
│  ├─ Model: Random Forest Classifier
│  ├─ CV Score: 0.8123 (+/- 0.0312)
│  └─ Top features: Sex, Pclass, Fare
│
└─ 📝 Submission Generator [✅ Completed]
   └─ Generated: submission.csv (418 predictions)
```

## Features

### Real-Time Updates
- WebSocket connection shows live progress
- See exactly what each agent is doing
- Logs stream in real-time

### Automatic Feature Engineering
- Handles missing values
- Encodes categorical variables
- Selects common features between train/test

### Smart Problem Detection
- Auto-detects classification vs regression
- Identifies target column
- Finds ID columns for submission

### Baseline Model
- Random Forest (100 trees, depth 10)
- 3-fold cross-validation
- Feature importance analysis

## API Reference

### REST Endpoints

**Start Pipeline**
```http
POST /api/kaggle/start
Content-Type: application/json

{
  "competition": "titanic",
  "apiToken": "KGAT_..." // optional
}

Response:
{
  "sessionId": "session_1707326400000",
  "message": "Pipeline started",
  "competition": "titanic"
}
```

**Check Status**
```http
GET /api/kaggle/status/:sessionId

Response:
{
  "competition": "titanic",
  "status": "running",
  "startTime": "2026-02-07T...",
  "stages": {
    "download": "completed",
    "analyze": "completed",
    "train": "running",
    "submit": "pending"
  }
}
```

**Download Submission**
```http
GET /api/kaggle/submission/:competition

Response: submission.csv file
```

### WebSocket Events

Connect to `ws://localhost:3001`:

```javascript
// Receive events
{
  "sessionId": "session_...",
  "stage": "train",
  "message": "CV Score: 0.8123 (+/- 0.0312)",
  "status": "running",
  "timestamp": "2026-02-07T16:30:00.000Z"
}
```

## Customization

### Adding New Models

Edit `backend/python/model_trainer.py`:

```python
from sklearn.ensemble import GradientBoostingClassifier

# Replace RandomForestClassifier with your model
model = GradientBoostingClassifier(
    n_estimators=200,
    learning_rate=0.1,
    max_depth=5,
    random_state=42
)
```

### Custom Feature Engineering

Edit `prepare_features()` in `model_trainer.py`:

```python
def prepare_features(train_df, test_df, target_col):
    # Add your feature engineering here
    train_df['new_feature'] = train_df['col1'] * train_df['col2']
    test_df['new_feature'] = test_df['col1'] * test_df['col2']

    # ... rest of function
```

### Additional Analysis

Edit `backend/python/data_analyzer.py` to add:
- Correlation analysis
- Distribution plots
- Missing value patterns
- Feature relationships

## File Structure

```
knowledge-graph/
├── backend/
│   ├── src/
│   │   └── index.js                 # Express + WebSocket server
│   ├── python/
│   │   ├── kaggle_downloader.py     # Downloads competition data
│   │   ├── data_analyzer.py         # Dataset analysis
│   │   ├── model_trainer.py         # ML training & prediction
│   │   └── requirements.txt         # Python dependencies
│   ├── data/
│   │   └── {competition}/           # Downloaded datasets
│   ├── submissions/
│   │   └── {competition}/           # Generated submissions
│   ├── package.json
│   └── setup.sh                     # Installation script
│
└── frontend/
    └── src/
        └── components/
            └── KaggleLab.js         # React UI component
```

## Troubleshooting

### Backend Won't Start
```bash
cd backend
npm install
# Check if port 3001 is available
lsof -i :3001
```

### Kaggle API Errors
```bash
# Test Kaggle CLI
kaggle competitions list

# If fails, check credentials
cat ~/.kaggle/kaggle.json
chmod 600 ~/.kaggle/kaggle.json
```

### Python Package Issues
```bash
pip3 install --upgrade -r backend/python/requirements.txt
```

### WebSocket Connection Failed
- Check backend is running on port 3001
- Check browser console for errors
- Verify firewall isn't blocking WebSocket

## Roadmap

- [ ] Support for more ML models (XGBoost, LightGBM)
- [ ] Hyperparameter tuning
- [ ] Ensemble methods
- [ ] Custom feature engineering UI
- [ ] Competition leaderboard integration
- [ ] Automatic submission to Kaggle
- [ ] Model performance tracking
- [ ] A/B testing different approaches

## Contributing

To add new features:

1. Backend: Add Python workers in `backend/python/`
2. API: Add endpoints in `backend/src/index.js`
3. Frontend: Update `KaggleLab.js` component
4. Test with a real Kaggle competition

## License

Built at ETH Oxford 2026

## Support

- Check backend logs: `cd backend && npm start`
- Check Python script outputs in WebSocket logs
- Test with simple competitions first (titanic, house-prices)

---

**Note**: This is a baseline system. For competitive scores, you'll need to:
- Tune hyperparameters
- Try different models
- Engineer better features
- Ensemble multiple models

But this gives you a strong starting point! 🚀
