import React, { useState, useCallback } from 'react';
import { runGNNPipeline } from '../utils/gnn';

const PHASES = [
  { id: 1, label: 'Building Graph Features' },
  { id: 2, label: 'Training GCN' },
  { id: 3, label: 'Predicting Links' },
];

function GNNPredictor({ graphData, onPredictionsReady }) {
  const [running, setRunning] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [completedPhases, setCompletedPhases] = useState(new Set());
  const [phaseInfo, setPhaseInfo] = useState(null);
  const [trainingProgress, setTrainingProgress] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [showOnGraph, setShowOnGraph] = useState(false);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setCurrentPhase(0);
    setCompletedPhases(new Set());
    setPhaseInfo(null);
    setTrainingProgress(null);
    setPredictions(null);
    setShowOnGraph(false);

    try {
      const results = await runGNNPipeline(graphData, {
        onPhaseStart: (phase) => {
          setCurrentPhase(phase);
        },
        onPhaseComplete: (phase, info) => {
          setCompletedPhases(prev => new Set([...prev, phase]));
          if (phase === 1) setPhaseInfo(info);
        },
        onTrainingProgress: ({ epoch, loss }) => {
          setTrainingProgress({ epoch, loss });
        },
      });

      setPredictions(results);
    } catch (err) {
      console.error('GNN pipeline error:', err);
    }
    setRunning(false);
  }, [graphData]);

  const handleToggleGraph = useCallback(() => {
    const next = !showOnGraph;
    setShowOnGraph(next);
    if (onPredictionsReady) {
      onPredictionsReady(next ? predictions : null);
    }
  }, [showOnGraph, predictions, onPredictionsReady]);

  const getPhaseStatus = (phaseId) => {
    if (completedPhases.has(phaseId)) return 'complete';
    if (currentPhase === phaseId) return 'active';
    return 'pending';
  };

  return (
    <div className="gnn-panel">
      <div className="gnn-header">
        <div className="gnn-title">
          <span className="gnn-icon">&#x1F9E0;</span>
          <h3>GCN Link Prediction</h3>
        </div>
        <button
          className="gnn-run-btn"
          onClick={handleRun}
          disabled={running || graphData.nodes.length < 3}
        >
          {running ? 'Running...' : 'Run GCN'}
        </button>
      </div>

      {(running || predictions) && (
        <>
          {/* Progress Bar */}
          <div className="p2a-progress-bar">
            {PHASES.map((phase, idx) => (
              <React.Fragment key={phase.id}>
                <div className="p2a-progress-step">
                  <div className={`p2a-progress-dot ${getPhaseStatus(phase.id)}`}>
                    {completedPhases.has(phase.id) ? '\u2713' : phase.id}
                  </div>
                  <span className={`p2a-progress-label ${getPhaseStatus(phase.id)}`}>
                    {phase.label}
                  </span>
                </div>
                {idx < PHASES.length - 1 && (
                  <div className={`p2a-progress-line ${completedPhases.has(phase.id) ? 'complete' : ''}`} />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Feature Info Card */}
          {phaseInfo && (
            <div className="gnn-info-card">
              <div className="gnn-info-item">
                <span className="gnn-info-value">{phaseInfo.nodeCount}</span>
                <span className="gnn-info-label">Nodes</span>
              </div>
              <div className="gnn-info-item">
                <span className="gnn-info-value">{phaseInfo.edgeCount}</span>
                <span className="gnn-info-label">Edges</span>
              </div>
              <div className="gnn-info-item">
                <span className="gnn-info-value">{phaseInfo.featDim}</span>
                <span className="gnn-info-label">Features</span>
              </div>
            </div>
          )}

          {/* Training Progress */}
          {currentPhase === 2 && trainingProgress && !completedPhases.has(2) && (
            <div className="gnn-training">
              <div className="gnn-training-row">
                <span>Epoch: <strong>{trainingProgress.epoch}/100</strong></span>
                <span>Loss: <strong>{trainingProgress.loss.toFixed(4)}</strong></span>
              </div>
              <div className="gnn-training-bar">
                <div
                  className="gnn-training-bar-fill"
                  style={{ width: `${trainingProgress.epoch}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Table */}
          {predictions && predictions.length > 0 && (
            <div className="gnn-results">
              <div className="gnn-results-header">
                <h4>Top Predicted Links</h4>
                <label className="gnn-toggle">
                  <input
                    type="checkbox"
                    checked={showOnGraph}
                    onChange={handleToggleGraph}
                  />
                  <span>Show on graph</span>
                </label>
              </div>
              <div className="gnn-results-table">
                {predictions.slice(0, 10).map((pred, i) => (
                  <div key={i} className="gnn-result-row">
                    <span className="gnn-result-rank">#{i + 1}</span>
                    <div className="gnn-result-papers">
                      <span className="gnn-result-paper">
                        {pred.sourceName.length > 35
                          ? pred.sourceName.slice(0, 33) + '...'
                          : pred.sourceName}
                      </span>
                      <span className="gnn-result-arrow">&harr;</span>
                      <span className="gnn-result-paper">
                        {pred.targetName.length > 35
                          ? pred.targetName.slice(0, 33) + '...'
                          : pred.targetName}
                      </span>
                    </div>
                    <div className="gnn-result-score-container">
                      <span className="gnn-result-confidence">
                        {(pred.score * 100).toFixed(1)}%
                      </span>
                      <div className="gnn-result-score-bar">
                        <div
                          className="gnn-result-score-fill"
                          style={{ width: `${pred.score * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {predictions && predictions.length === 0 && (
            <div className="gnn-empty">
              No new links predicted — the graph is already well-connected.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default GNNPredictor;
