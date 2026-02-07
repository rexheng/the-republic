import React, { useState } from 'react';

const TYPE_LABELS = {
  breakthrough: 'Breakthrough',
  critical_gap: 'Critical Gap',
  direction: 'Direction',
};

const TYPE_COLORS = {
  breakthrough: '#d69e2e',
  critical_gap: '#e53e3e',
  direction: '#667eea',
};

function CheckpointDialog({ checkpoint, onContinue, onRedirect, onStop }) {
  const [feedback, setFeedback] = useState('');
  const [showRedirect, setShowRedirect] = useState(false);
  const [newGuidance, setNewGuidance] = useState('');

  if (!checkpoint) return null;

  const { iterationId, topFindings = [], stats = {} } = checkpoint;

  return (
    <div className="ralph-checkpoint-overlay">
      <div className="ralph-checkpoint-dialog">
        <div className="ralph-checkpoint-header">
          <h3>Checkpoint: Iteration {iterationId}</h3>
          <p>RALPH has completed {iterationId} iterations. Review progress and decide how to proceed.</p>
        </div>

        <div className="ralph-checkpoint-stats">
          <div className="ralph-checkpoint-stat">
            <span className="ralph-checkpoint-stat-val">{stats.hypothesesChecked || 0}</span>
            <span className="ralph-checkpoint-stat-lbl">Checked</span>
          </div>
          <div className="ralph-checkpoint-stat">
            <span className="ralph-checkpoint-stat-val">{stats.avgNovelty || 0}%</span>
            <span className="ralph-checkpoint-stat-lbl">Avg Novelty</span>
          </div>
          <div className="ralph-checkpoint-stat">
            <span className="ralph-checkpoint-stat-val">{stats.avgTrust || 0}%</span>
            <span className="ralph-checkpoint-stat-lbl">Avg Trust</span>
          </div>
          <div className="ralph-checkpoint-stat">
            <span className="ralph-checkpoint-stat-val">{stats.totalFlags || 0}</span>
            <span className="ralph-checkpoint-stat-lbl">Flags</span>
          </div>
        </div>

        {topFindings.length > 0 && (
          <div className="ralph-checkpoint-findings">
            <h4>Top Findings</h4>
            <div className="ralph-checkpoint-findings-list">
              {topFindings.slice(0, 8).map((f, i) => (
                <div key={i} className="ralph-checkpoint-finding">
                  <span
                    className="ralph-checkpoint-finding-type"
                    style={{ background: (TYPE_COLORS[f.type] || '#a0aec0') + '20', color: TYPE_COLORS[f.type] || '#a0aec0' }}
                  >
                    {TYPE_LABELS[f.type] || f.type}
                  </span>
                  <span className="ralph-checkpoint-finding-iter">Iter {f.iterationId}</span>
                  <span className="ralph-checkpoint-finding-text">{f.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="ralph-checkpoint-feedback">
          <label>Notes (optional)</label>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Any observations or notes about the run so far..."
            rows={2}
          />
        </div>

        {showRedirect && (
          <div className="ralph-checkpoint-redirect">
            <label>New Research Direction</label>
            <textarea
              value={newGuidance}
              onChange={(e) => setNewGuidance(e.target.value)}
              placeholder="e.g. Focus more on protein folding approaches using diffusion models..."
              rows={2}
              autoFocus
            />
          </div>
        )}

        <div className="ralph-checkpoint-actions">
          <button
            className="ralph-btn ralph-btn-start"
            onClick={() => onContinue(feedback)}
          >
            Continue
          </button>
          {!showRedirect ? (
            <button
              className="ralph-btn ralph-btn-redirect"
              onClick={() => setShowRedirect(true)}
            >
              Redirect
            </button>
          ) : (
            <button
              className="ralph-btn ralph-btn-redirect"
              onClick={() => onRedirect(feedback, newGuidance)}
              disabled={!newGuidance.trim()}
            >
              Apply New Direction
            </button>
          )}
          <button
            className="ralph-btn ralph-btn-stop"
            onClick={() => onStop(feedback)}
          >
            Stop Run
          </button>
        </div>
      </div>
    </div>
  );
}

export default CheckpointDialog;
