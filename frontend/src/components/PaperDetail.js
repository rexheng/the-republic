import React from 'react';
import { GRAPH_COLORS } from '../config';
import EvaluationDisplay from './EvaluationDisplay';

function PaperDetail({ paper, onClose, onImport, onMakeRunnable, onReplicate, evaluations }) {
  if (!paper) return null;

  const sourceLabel = paper.onChain ? 'On-Chain' : paper.source === 'seed' ? 'Seed Data' : 'Semantic Scholar';
  const sourceColor = paper.isUserPaper ? GRAPH_COLORS.USER :
    paper.onChain ? GRAPH_COLORS.ONCHAIN : GRAPH_COLORS.EXTERNAL;

  const statusLabels = ['Submitted', 'Under Review', 'Accepted', 'Rejected'];

  return (
    <div className="paper-detail-overlay" onClick={onClose}>
      <div className="paper-detail-sidebar" onClick={e => e.stopPropagation()}>
        <div className="paper-detail-header">
          <button className="paper-detail-close" onClick={onClose}>
            &times;
          </button>
          <span className="paper-detail-source" style={{ background: sourceColor + '22', color: sourceColor }}>
            {sourceLabel}
          </span>
        </div>

        <h2 className="paper-detail-title">{paper.title}</h2>

        <div className="paper-detail-authors">
          {(paper.authors || []).map((a, i) => (
            <span key={i} className="author-chip">
              {typeof a === 'string' ? a : a.name}
            </span>
          ))}
        </div>

        <div className="paper-detail-meta">
          {paper.year && <div className="meta-item"><strong>Year:</strong> {paper.year}</div>}
          <div className="meta-item"><strong>Citations:</strong> {(paper.citationCount || 0).toLocaleString()}</div>
          {paper.fieldsOfStudy?.length > 0 && (
            <div className="meta-item">
              <strong>Fields:</strong> {paper.fieldsOfStudy.join(', ')}
            </div>
          )}
          {paper.doi && (
            <div className="meta-item">
              <strong>DOI:</strong>{' '}
              <a href={`https://doi.org/${paper.doi}`} target="_blank" rel="noopener noreferrer">
                {paper.doi}
              </a>
            </div>
          )}
        </div>

        {paper.abstract && (
          <div className="paper-detail-abstract">
            <h3>Abstract</h3>
            <p>{paper.abstract}</p>
          </div>
        )}

        {paper.onChain && (
          <div className="paper-detail-onchain">
            <h3>On-Chain Data</h3>
            <div className="meta-item">
              <strong>Paper ID:</strong> #{paper.onChainId}
            </div>
            <div className="meta-item">
              <strong>Status:</strong>{' '}
              <span className={`status-badge status-${paper.onChainStatus}`}>
                {statusLabels[paper.onChainStatus] || 'Unknown'}
              </span>
            </div>
            {paper.onChainAuthor && (
              <div className="meta-item">
                <strong>Author:</strong>{' '}
                <code>{paper.onChainAuthor.slice(0, 6)}...{paper.onChainAuthor.slice(-4)}</code>
              </div>
            )}
            {paper.ipfsHash && (
              <div className="meta-item">
                <strong>IPFS:</strong>{' '}
                <a href={`https://ipfs.io/ipfs/${paper.ipfsHash}`} target="_blank" rel="noopener noreferrer">
                  {paper.ipfsHash.slice(0, 12)}...
                </a>
              </div>
            )}
          </div>
        )}

        {evaluations && evaluations.length > 0 && (
          <div className="paper-detail-eval">
            <h3>Evaluation Summary</h3>
            <EvaluationDisplay evaluations={evaluations} compact />
          </div>
        )}

        {paper.paperId && paper.paperId.length > 10 && (
          <a
            href={`https://www.semanticscholar.org/paper/${paper.paperId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-small paper-detail-link"
          >
            View on Semantic Scholar
          </a>
        )}

        {paper.githubRepo && onMakeRunnable && (
          <button
            className="btn paper-detail-runnable"
            onClick={() => onMakeRunnable(paper)}
          >
            &#128640; Make Runnable
          </button>
        )}

        {onReplicate && (
          <button
            className="btn paper-detail-replicate"
            onClick={() => onReplicate(paper)}
          >
            &#129514; Replicate
          </button>
        )}

        {!paper.onChain && onImport && (
          <button
            className="btn btn-primary paper-detail-import"
            onClick={() => onImport(paper)}
          >
            Import to Blockchain
          </button>
        )}
      </div>
    </div>
  );
}

export default PaperDetail;
