# 🚀 Quick Start: Kaggle Competition Workflow

Get up and running in 5 minutes!

## Step 1: Install Dependencies

```bash
# From project root
cd backend
./setup.sh
```

This installs:
- Node.js dependencies (Express, WebSocket, etc.)
- Python packages (kaggle, pandas, scikit-learn, etc.)

## Step 2: Get Kaggle API Token

1. Go to [kaggle.com/settings](https://www.kaggle.com/settings)
2. Scroll to "API" section
3. Click "Create New API Token"
4. Save your token (starts with `KGAT_...`)

**Your token:** `KGAT_c9e2ef8b04f6bf54606210da5cde9b1b`

## Step 3: Start Backend

```bash
cd backend
npm start
```

You should see:
```
Backend server running on http://localhost:3001
WebSocket server running on ws://localhost:3001
```

## Step 4: Start Frontend

In a new terminal:

```bash
cd frontend
npm start
```

Frontend opens at `http://localhost:3000`

## Step 5: Run Your First Pipeline

1. **Connect Wallet** in the app
2. Click **"🏆 Kaggle Lab"** tab
3. Enter competition: `titanic`
4. (Optional) Paste your API token: `KGAT_c9e2ef8b04f6bf54606210da5cde9b1b`
5. Click **"🚀 Start Pipeline"**

Watch the magic happen:
- 📥 Data Downloader fetches competition files
- 📊 Data Analyzer explores the dataset
- 🤖 Model Trainer builds Random Forest model
- 📝 Submission Generator creates submission.csv

## Step 6: Download Submission

When all agents show ✅ Completed:

1. Click **"📥 Download Submission"**
2. Go to [kaggle.com/c/titanic/submit](https://www.kaggle.com/c/titanic/submit)
3. Upload your `submission.csv`
4. See your score!

## Troubleshooting

### "Failed to start pipeline"
- Check backend is running on port 3001
- Check terminal for error messages

### "Kaggle API error"
- Verify your API token is correct
- Check token hasn't expired
- Try configuring `~/.kaggle/kaggle.json` system-wide

### Python errors
```bash
cd backend
pip3 install -r python/requirements.txt
```

### Port already in use
```bash
# Kill process on port 3001
lsof -ti:3001 | xargs kill -9
```

## Next Steps

Try other competitions:
- `house-prices-advanced-regression-techniques`
- `digit-recognizer`
- `spaceship-titanic`

Customize the model:
- Edit `backend/python/model_trainer.py`
- Try different algorithms (XGBoost, LightGBM)
- Add feature engineering

## Architecture

```
Frontend (React)
    ↓ HTTP/WebSocket
Backend (Express)
    ↓ spawn
Python Workers
    ↓ Kaggle API
Competition Data → Model → Submission
```

## File Locations

- Backend: `/backend/`
- Python workers: `/backend/python/`
- Downloaded data: `/backend/data/{competition}/`
- Submissions: `/backend/submissions/{competition}/`
- Frontend component: `/frontend/src/components/KaggleLab.js`

## Need Help?

See full documentation: `KAGGLE_WORKFLOW.md`

---

**Pro Tip**: Start with Titanic competition - it's simple, well-documented, and perfect for testing! 🚢
