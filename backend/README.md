# Kaggle Competition Workflow Backend

Automated backend system for Kaggle competition pipelines.

## Features

- 🚀 Automated data download via Kaggle CLI
- 📊 Dataset analysis and insights
- 🤖 Baseline ML model training (Random Forest)
- 📝 Automatic submission file generation
- 🔄 Real-time WebSocket updates
- 📡 RESTful API

## Setup

### 1. Install Node.js Dependencies

```bash
cd backend
npm install
```

### 2. Install Python Dependencies

```bash
pip install -r python/requirements.txt
```

Required packages:
- kaggle
- pandas
- numpy
- scikit-learn
- matplotlib
- seaborn

### 3. Configure Kaggle API

You have two options:

**Option A: Use API Token in Request**
Pass your Kaggle API token (`KGAT_...`) when starting a pipeline through the frontend.

**Option B: Configure System-Wide**
1. Get your Kaggle API token from https://kaggle.com/settings
2. Create `~/.kaggle/kaggle.json`:
   ```json
   {
     "username": "your-username",
     "key": "your-api-key"
   }
   ```
3. Set permissions: `chmod 600 ~/.kaggle/kaggle.json`

## Running

Start the backend server:

```bash
npm start
```

Server runs on `http://localhost:3001` with WebSocket on `ws://localhost:3001`

## API Endpoints

### Start Pipeline
```
POST /api/kaggle/start
Body: {
  "competition": "titanic",
  "apiToken": "KGAT_..." (optional)
}
```

### Get Session Status
```
GET /api/kaggle/status/:sessionId
```

### List All Sessions
```
GET /api/kaggle/sessions
```

### Download Submission
```
GET /api/kaggle/submission/:competition
```

### Health Check
```
GET /health
```

## WebSocket Events

Connect to `ws://localhost:3001` to receive real-time pipeline updates:

```javascript
{
  "sessionId": "session_1234567890",
  "stage": "download|analyze|train|submit",
  "message": "Log message",
  "status": "pending|running|completed|error",
  "timestamp": "2026-02-07T..."
}
```

## Pipeline Stages

1. **Download** - Fetches competition data using Kaggle CLI
2. **Analyze** - Explores dataset structure and statistics
3. **Train** - Trains baseline Random Forest model
4. **Submit** - Generates submission.csv file

## File Structure

```
backend/
├── src/
│   └── index.js          # Express server + WebSocket
├── python/
│   ├── kaggle_downloader.py   # Data downloader
│   ├── data_analyzer.py       # Dataset analyzer
│   ├── model_trainer.py       # ML trainer
│   └── requirements.txt       # Python dependencies
├── data/
│   └── {competition}/         # Downloaded datasets
└── submissions/
    └── {competition}/         # Generated submissions
```

## Testing

Test with the Titanic competition:

1. Start backend: `npm start`
2. Navigate to Kaggle Lab tab in frontend
3. Enter "titanic" as competition name
4. Click "Start Pipeline"
5. Watch the pipeline progress
6. Download submission.csv when complete

## Error Handling

- If Kaggle CLI fails, check API credentials
- If Python scripts fail, check package installations
- WebSocket disconnects are automatically handled
- All errors are broadcast via WebSocket

## Development

To add new competitions or customize the pipeline:

1. Modify Python workers in `python/` directory
2. Update Express routes in `src/index.js`
3. Restart backend to apply changes

## Notes

- Python 3.7+ required
- Kaggle CLI must be properly configured
- Supports both classification and regression tasks
- Baseline model is Random Forest (can be customized)
